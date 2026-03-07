import * as cron from 'node-cron';
import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { Context } from '../utils/types';
import { StockQuote } from '../utils/polygon-service';

const SWING_CHECK_INTERVAL_CRON = '*/15 9-16 * * 1-5'; // Every 15 min during market hours (ET)
const MARKET_OPEN_CRON = '30 9 * * 1-5'; // 9:30 AM ET Mon-Fri
const MARKET_CLOSE_CRON = '1 16 * * 1-5'; // 4:01 PM ET Mon-Fri (1 min after close for final data)
const DEFAULT_SWING_THRESHOLD = 5; // 5% default

interface TrackedStock {
    ticker: string;
    channel_id: string;
    guild_id: string;
    threshold: number | null;
}

export class StockSchedulerService {
    private client: Client;
    private context: Context;
    private cronTasks: cron.ScheduledTask[] = [];
    private isShuttingDown = false;

    constructor(client: Client, context: Context) {
        this.client = client;
        this.context = context;
    }

    async initialize(): Promise<void> {
        try {
            // Check if there are any active stock trackings before scheduling
            const activeCount = await this.context.tables.StockTracking.count({
                where: { is_active: true },
            });

            if (activeCount === 0) {
                this.context.log.info(
                    { category: 'stock_scheduler' },
                    'No active stock trackings found - scheduler will activate when tracking is added',
                );
                return;
            }

            this.startCronJobs();
            this.context.log.info(
                { category: 'stock_scheduler', activeTrackings: activeCount },
                'Stock scheduler service initialized',
            );
        } catch (error) {
            this.context.log.error(
                { error, category: 'stock_scheduler' },
                'Failed to initialize stock scheduler service',
            );
        }
    }

    startCronJobs(): void {
        if (this.cronTasks.length > 0) {
            return; // Already started
        }

        // Market open notifications
        const openTask = cron.schedule(MARKET_OPEN_CRON, async () => {
            if (this.isShuttingDown) {return;}
            await this.sendMarketNotifications('market_open');
        }, { timezone: 'America/New_York' });

        // Market close notifications
        const closeTask = cron.schedule(MARKET_CLOSE_CRON, async () => {
            if (this.isShuttingDown) {return;}
            await this.sendMarketNotifications('market_close');
        }, { timezone: 'America/New_York' });

        // Big swing checker
        const swingTask = cron.schedule(SWING_CHECK_INTERVAL_CRON, async () => {
            if (this.isShuttingDown) {return;}
            await this.checkBigSwings();
        }, { timezone: 'America/New_York' });

        this.cronTasks.push(openTask, closeTask, swingTask);
    }

    private async getPolygonService(): Promise<any> {
        const polygonModule = await import('../utils/polygon-service');
        const { PolygonService } = polygonModule;
        return new PolygonService(this.context.log);
    }

    private async sendMarketNotifications(feature: 'market_open' | 'market_close'): Promise<void> {
        try {
            const trackings = await this.context.tables.StockTracking.findAll({
                where: { feature, is_active: true },
            });

            if (trackings.length === 0) {return;}

            // Group by channel to batch notifications
            const byChannel = new Map<string, string[]>();
            for (const t of trackings) {
                const key = t.channel_id;
                if (!byChannel.has(key)) {byChannel.set(key, []);}
                const tickers = byChannel.get(key)!;
                if (!tickers.includes(t.ticker)) {tickers.push(t.ticker);}
            }

            const service = await this.getPolygonService();

            for (const [channelId, tickers] of byChannel) {
                try {
                    const channel = this.client.channels.cache.get(channelId) as TextChannel | undefined;
                    if (!channel?.isTextBased()) {continue;}

                    const quotes = await this.fetchQuotesBatched(service, tickers);
                    if (quotes.length === 0) {continue;}

                    const embed = this.buildSummaryEmbed(quotes, feature);
                    await channel.send({ embeds: [embed] });

                    // Update last_notified_at
                    const tickerList = quotes.map(q => q.symbol);
                    await this.context.tables.StockTracking.update(
                        { last_notified_at: new Date() },
                        { where: { channel_id: channelId, feature, ticker: tickerList, is_active: true } },
                    );
                } catch (channelError) {
                    this.context.log.error(
                        { error: channelError, channelId, category: 'stock_scheduler' },
                        'Failed to send market notification to channel',
                    );
                }
            }

            this.context.log.info(
                { feature, channels: byChannel.size, category: 'stock_scheduler' },
                `Sent ${feature} notifications`,
            );
        } catch (error) {
            this.context.log.error(
                { error, feature, category: 'stock_scheduler' },
                'Failed to send market notifications',
            );
        }
    }

    private async checkBigSwings(): Promise<void> {
        try {
            const trackings = await this.context.tables.StockTracking.findAll({
                where: { feature: 'big_swing', is_active: true },
            });

            if (trackings.length === 0) {return;}

            // Group by channel
            const byChannel = new Map<string, TrackedStock[]>();
            for (const t of trackings) {
                const key = t.channel_id;
                if (!byChannel.has(key)) {byChannel.set(key, []);}
                byChannel.get(key)!.push({
                    ticker: t.ticker,
                    channel_id: t.channel_id,
                    guild_id: t.guild_id,
                    threshold: t.threshold ?? DEFAULT_SWING_THRESHOLD,
                });
            }

            const service = await this.getPolygonService();

            for (const [channelId, stocks] of byChannel) {
                const uniqueTickers = [...new Set(stocks.map(s => s.ticker))];
                const quotes = await this.fetchQuotesBatched(service, uniqueTickers);

                const alerts: StockQuote[] = [];
                for (const quote of quotes) {
                    const stock = stocks.find(s => s.ticker === quote.symbol);
                    const threshold = stock?.threshold ?? DEFAULT_SWING_THRESHOLD;

                    if (Math.abs(quote.changePercent) >= threshold) {
                        // Check cooldown - don't alert more than once per hour per ticker
                        const lastNotified = await this.context.tables.StockTracking.findOne({
                            where: {
                                channel_id: channelId,
                                ticker: quote.symbol,
                                feature: 'big_swing',
                                is_active: true,
                            },
                        });

                        if (lastNotified?.last_notified_at) {
                            const hourAgo = new Date(Date.now() - 60 * 60 * 1000);
                            if (new Date(lastNotified.last_notified_at) > hourAgo) {
                                continue; // Skip - already notified within the hour
                            }
                        }

                        alerts.push(quote);
                    }
                }

                if (alerts.length === 0) {continue;}

                try {
                    const channel = this.client.channels.cache.get(channelId) as TextChannel | undefined;
                    if (!channel?.isTextBased()) {continue;}

                    for (const alert of alerts) {
                        const embed = this.buildSwingAlertEmbed(alert);
                        await channel.send({ embeds: [embed] });

                        await this.context.tables.StockTracking.update(
                            { last_notified_at: new Date() },
                            {
                                where: {
                                    channel_id: channelId, ticker: alert.symbol,
                                    feature: 'big_swing', is_active: true,
                                },
                            },
                        );
                    }
                } catch (channelError) {
                    this.context.log.error(
                        { error: channelError, channelId, category: 'stock_scheduler' },
                        'Failed to send swing alert to channel',
                    );
                }
            }
        } catch (error) {
            this.context.log.error(
                { error, category: 'stock_scheduler' },
                'Failed to check big swings',
            );
        }
    }

    private async fetchQuotesBatched(service: any, tickers: string[]): Promise<StockQuote[]> {
        const quotes: StockQuote[] = [];
        for (const ticker of tickers) {
            try {
                const quote = await service.getStockQuote(ticker);
                if (quote) {quotes.push(quote);}
            } catch (error) {
                this.context.log.warn(
                    { ticker, error, category: 'stock_scheduler' },
                    `Failed to fetch quote for ${ticker}`,
                );
            }
        }
        return quotes;
    }

    private buildSummaryEmbed(quotes: StockQuote[], feature: 'market_open' | 'market_close'): EmbedBuilder {
        const isOpen = feature === 'market_open';
        const title = isOpen ? 'Market Open Summary' : 'Market Close Summary';
        const color = isOpen ? 0x00aa00 : 0xaa0000;

        const embed = new EmbedBuilder()
            .setTitle(title)
            .setColor(color)
            .setTimestamp(new Date());

        const lines = quotes.map(q => {
            const arrow = q.change >= 0 ? '+' : '';
            return `**${q.symbol}** $${q.price.toFixed(2)} (${arrow}${q.changePercent.toFixed(2)}%)`;
        });

        embed.setDescription(lines.join('\n'));
        embed.setFooter({ text: 'Data from Polygon.io' });

        return embed;
    }

    private buildSwingAlertEmbed(quote: StockQuote): EmbedBuilder {
        const direction = quote.change >= 0 ? 'UP' : 'DOWN';
        const color = quote.change >= 0 ? 0x00ff00 : 0xff0000;
        const emoji = quote.change >= 0 ? '🚀' : '📉';

        return new EmbedBuilder()
            .setTitle(`${emoji} Big Swing Alert: ${quote.symbol}`)
            .setColor(color)
            .setDescription(
                `**${quote.symbol}** is ${direction} **${Math.abs(quote.changePercent).toFixed(2)}%**`,
            )
            .addFields(
                { name: 'Price', value: `$${quote.price.toFixed(2)}`, inline: true },
                { name: 'Change', value: `${quote.change >= 0 ? '+' : ''}$${quote.change.toFixed(2)}`, inline: true },
                { name: 'Volume', value: quote.volume.toLocaleString(), inline: true },
            )
            .setFooter({ text: 'Data from Polygon.io' })
            .setTimestamp(new Date());
    }

    shutdown(): void {
        this.isShuttingDown = true;
        for (const task of this.cronTasks) {
            void task.stop();
        }
        this.cronTasks = [];
        this.context.log.info({ category: 'stock_scheduler' }, 'Stock scheduler service shut down');
    }
}
