import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { Context } from '../utils/types';

// Initialize Polygon service - will be done once per import
let polygonService: any = null;

async function getPolygonService(context: Context): Promise<any> {
    if (!polygonService) {
        const apiKey = process.env.POLYGON_API_KEY;

        // Use mock service for placeholder API key
        if (apiKey === 'placeholder-key-for-testing') {
            context.log.info('Using mock stock service for placeholder API key');
            polygonService = new MockPolygonService(context.log);
            return polygonService;
        }

        try {
            // Dynamic import to avoid module resolution issues
            const polygonModule = await import('../utils/polygon-service');
            const { PolygonService } = polygonModule;
            polygonService = new PolygonService(context.log);
        } catch (error) {
            context.log.error('Failed to load PolygonService', {
                error: error instanceof Error ? error.message : 'Unknown error',
            });
            throw new Error('Stock data service is not available. Please contact support.');
        }
    }
    return polygonService;
}

// Mock service that bypasses the problematic polygon.io import entirely
class MockPolygonService {
    private logger: any;

    constructor(logger: any) {
        this.logger = logger;
        logger.info('MockPolygonService initialized for local testing');
    }

    async getStockQuote(symbol: string) {
        const normalizedSymbol = symbol.toUpperCase();
        this.logger.info(`Returning mock data for ${normalizedSymbol}`);

        // Mock data for common symbols
        const mockPrices: { [key: string]: number } = {
            'AAPL': 175.50,
            'MSFT': 415.25,
            'GOOGL': 2850.75,
            'TSLA': 225.30,
            'AMZN': 3420.85,
            'NVDA': 875.40,
            'META': 298.65,
            'NFLX': 450.20,
        };

        const basePrice = mockPrices[normalizedSymbol] || 100.00;
        const change = (Math.random() - 0.5) * 10; // Random change between -5 and +5
        const changePercent = (change / basePrice) * 100;
        const volume = Math.floor(Math.random() * 50000000) + 1000000; // Random volume

        return {
            symbol: normalizedSymbol,
            price: basePrice + change,
            change: change,
            changePercent: changePercent,
            volume: volume,
            high: basePrice + Math.abs(change) + Math.random() * 5,
            low: basePrice - Math.abs(change) - Math.random() * 5,
            open: basePrice + (Math.random() - 0.5) * 2,
            previousClose: basePrice,
            timestamp: Date.now(),
            isMarketOpen: this.isMarketOpen(),
        };
    }

    getRateLimitStatus() {
        return { remaining: 5 };
    }

    private isMarketOpen(): boolean {
        const now = new Date();
        const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));
        const day = et.getDay(); // 0 = Sunday, 6 = Saturday

        if (day === 0 || day === 6) {
            return false; // Weekend
        }

        const hour = et.getHours();
        const minute = et.getMinutes();
        const timeInMinutes = hour * 60 + minute;

        const marketOpen = 9 * 60 + 30; // 9:30 AM
        const marketClose = 16 * 60; // 4:00 PM

        return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
    }
}

// Helper function to create stock embed
function createStockEmbed(stockData: any, service: any): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setTitle(`📈 ${stockData.symbol} Stock Quote`)
        .setColor(stockData.change >= 0 ? 0x00ff00 : 0xff0000) // Green for positive, red for negative
        .setTimestamp(new Date(stockData.timestamp));

    // Price and change information
    const changeEmoji = stockData.change >= 0 ? '📈' : '📉';
    const changePrefix = stockData.change >= 0 ? '+' : '';

    embed.addFields(
        {
            name: '💰 Current Price',
            value: `$${stockData.price.toFixed(2)}`,
            inline: true,
        },
        {
            name: `${changeEmoji} Change`,
            value: `${changePrefix}$${stockData.change.toFixed(2)}\n` +
                   `${changePrefix}${stockData.changePercent.toFixed(2)}%`,
            inline: true,
        },
        {
            name: '📊 Volume',
            value: stockData.volume.toLocaleString(),
            inline: true,
        },
        {
            name: '🔺 High',
            value: `$${stockData.high.toFixed(2)}`,
            inline: true,
        },
        {
            name: '🔻 Low',
            value: `$${stockData.low.toFixed(2)}`,
            inline: true,
        },
        {
            name: '🏁 Previous Close',
            value: `$${stockData.previousClose.toFixed(2)}`,
            inline: true,
        },
    );

    // Market status
    const marketStatus = stockData.isMarketOpen ? '🟢 Market Open' : '🔴 Market Closed';
    embed.setFooter({
        text: `${marketStatus} • Data from Polygon.io • ` +
              `${new Date(stockData.timestamp).toLocaleString()}`,
    });

    // Rate limiting info for transparency
    const rateLimitStatus = service.getRateLimitStatus();
    if (rateLimitStatus.remaining <= 1) {
        embed.setDescription('⚠️ *API rate limit approaching. ' +
                             'Responses may be slower for the next few minutes.*');
    }

    return embed;
}

// Helper function to handle stock errors
async function handleStockError(
    error: unknown,
    ticker: string,
    interaction: CommandInteraction,
    context: Context,
    isFollowUp: boolean = false,
) {
    const { log } = context;

    log.error('Error in stock command execution', {
        ticker,
        user: interaction.user.username,
        error: error instanceof Error ? error.message : 'Unknown error',
    });

    // Enhanced error messages based on error type
    let errorMessage = `❌ **Error fetching stock data for ${ticker.toUpperCase()}**\n\n`;

    if (error instanceof Error) {
        const errorMsg = error.message.toLowerCase();

        if (errorMsg.includes('rate limit') || errorMsg.includes('429')) {
            errorMessage += `🚦 **Rate Limit Reached**\n` +
                           `• You've hit the API rate limit (5 requests per minute)\n` +
                           `• Please wait a few minutes before trying again\n` +
                           `• Consider tracking fewer stocks to stay within limits`;
        } else if (errorMsg.includes('network') || errorMsg.includes('timeout')) {
            errorMessage += `🌐 **Network Issue**\n` +
                           `• Connection to stock data provider failed\n` +
                           `• This is usually temporary\n• Try again in 30 seconds`;
        } else if (errorMsg.includes('invalid') || errorMsg.includes('not found')) {
            errorMessage += `🔍 **Invalid Ticker Symbol**\n` +
                           `• "${ticker.toUpperCase()}" may not be a valid stock symbol\n` +
                           `• Make sure it's traded on US exchanges (NYSE, NASDAQ)\n` +
                           `• Try popular symbols like: AAPL, TSLA, MSFT, GOOGL`;
        } else if (errorMsg.includes('market closed') || errorMsg.includes('after hours')) {
            errorMessage += `🕐 **Market Hours Issue**\n• Stock market may be closed\n` +
                           `• Data might be delayed during pre/post market hours\n` +
                           `• Regular hours: 9:30 AM - 4:00 PM ET, Monday-Friday`;
        } else if (errorMsg.includes('permission') || errorMsg.includes('unauthorized')) {
            errorMessage += `🔐 **API Authorization Issue**\n` +
                           `• There's a problem with our stock data access\n` +
                           `• This is a temporary service issue\n` +
                           `• Please try again later or contact support`;
        } else {
            errorMessage += `⚠️ **Unexpected Error**\n` +
                           `• Something went wrong while fetching stock data\n` +
                           `• This might be a temporary service issue\n• Try again in a few minutes`;
        }
    } else {
        errorMessage += `⚠️ **Unknown Error**\n• An unexpected error occurred\n` +
                       `• Please try again in a few minutes\n` +
                       `• If this persists, the stock data service may be down`;
    }

    errorMessage += `\n\n💡 **Tips:**\n• Use valid ticker symbols (1-10 letters, no numbers)\n` +
                   `• Check if the company is publicly traded in the US\n` +
                   `• Wait between requests to avoid rate limiting`;

    // Check if we're near rate limit and add warning
    try {
        const service = await getPolygonService(context);
        const rateLimitStatus = service.getRateLimitStatus();
        if (rateLimitStatus.remaining <= 2) {
            errorMessage += `\n\n⚠️ **Rate limit warning:** Only ` +
                           `${rateLimitStatus.remaining} requests remaining this minute.`;
        }
    } catch (rateLimitError) {
        // Ignore rate limit check errors
    }

    if (isFollowUp) {
        await interaction.followUp({ content: errorMessage });
    } else {
        await interaction.editReply({ content: errorMessage });
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('stock')
        .setDescription('Stock market commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Get current stock price')
                .addStringOption(option =>
                    option
                        .setName('ticker')
                        .setDescription('Stock ticker symbol (e.g., AAPL, TSLA, MSFT)')
                        .setRequired(true)
                        .setMaxLength(10)
                        .setAutocomplete(true),
                ),
        ),

    async execute(interaction: CommandInteraction, context: Context) {
        const { log } = context;

        // Check if this is a chat input command with options
        if (!interaction.isChatInputCommand()) {
            return;
        }

        const subcommand = interaction.options.getSubcommand();

        // Check if this is the 'get' subcommand
        if (subcommand !== 'get') {
            await interaction.reply({
                content: 'Unknown subcommand. Use `/stock get <ticker>` to get stock prices.',
                ephemeral: true,
            });
            return;
        }

        // Get the ticker symbol
        const ticker = interaction.options.getString('ticker');

        if (!ticker) {
            await interaction.reply({
                content: 'Please provide a ticker symbol. Example: `/stock get AAPL`',
                ephemeral: true,
            });
            return;
        }

        // Validate ticker format (basic validation)
        const tickerRegex = /^[A-Za-z]{1,10}$/;
        if (!tickerRegex.test(ticker)) {
            await interaction.reply({
                content: 'Invalid ticker format. Please use 1-10 letters only (e.g., AAPL, MSFT).',
                ephemeral: true,
            });
            return;
        }

        log.info(`Stock command executed by ${interaction.user.username} for ticker: ${ticker.toUpperCase()}`);

        // Get Polygon service and check rate limits before proceeding
        const service = await getPolygonService(context);
        const rateLimitStatus = service.getRateLimitStatus();

        // Check if we're at the rate limit
        if (rateLimitStatus.remaining <= 0) {
            await interaction.reply({
                content: `🚦 **Rate Limit Exceeded**\n\n` +
                        `You've reached the maximum of 5 stock requests per minute.\n\n` +
                        `⏰ **Please wait about 1 minute before trying again.**\n\n` +
                        `💡 **Tip:** Spread out your stock queries to avoid hitting rate limits.`,
                ephemeral: true,
            });
            return;
        }

        // Warn if close to rate limit
        if (rateLimitStatus.remaining <= 2) {
            await interaction.reply({
                content: `⚠️ **Rate Limit Warning**\n\n` +
                        `You have ${rateLimitStatus.remaining} requests remaining this minute.\n\n` +
                        `Fetching data for **${ticker.toUpperCase()}**...`,
                ephemeral: false,
            });

            // Use followUp instead of deferReply since we already replied
            try {
                const stockData = await service.getStockQuote(ticker);

                if (!stockData) {
                    await interaction.followUp({
                        content: `❌ Could not find stock data for ticker: **${ticker.toUpperCase()}**\n\n` +
                                `Please check that the ticker symbol is correct and ` +
                                `that it's traded on US exchanges.`,
                    });
                    return;
                }

                const embed = createStockEmbed(stockData, service);
                await interaction.followUp({ embeds: [embed] });

                log.info(`Successfully provided stock data for ${stockData.symbol}: ` +
                         `$${stockData.price} (rate limit warning issued)`);
                return;

            } catch (error) {
                await handleStockError(error, ticker, interaction, context, true);
                return;
            }
        }

        // Normal flow - defer reply since API call might take time
        await interaction.deferReply({ ephemeral: false });

        try {
            const stockData = await service.getStockQuote(ticker);

            if (!stockData) {
                await interaction.editReply({
                    content: `❌ Could not find stock data for ticker: **${ticker.toUpperCase()}**\n\n` +
                            `Please check that the ticker symbol is correct and ` +
                            `that it's traded on US exchanges.`,
                });
                return;
            }

            // Create and send embed with stock data
            const embed = createStockEmbed(stockData, service);
            await interaction.editReply({ embeds: [embed] });

            log.info(`Successfully provided stock data for ${stockData.symbol}: $${stockData.price}`);

        } catch (error) {
            await handleStockError(error, ticker, interaction, context, false);
        }
    },

    async autocomplete(interaction: any) {
        const focusedValue = interaction.options.getFocused().toLowerCase();

        // Popular stock tickers for autocomplete
        const popularStocks = [
            // Tech giants
            { name: 'AAPL - Apple Inc.', value: 'AAPL' },
            { name: 'MSFT - Microsoft Corporation', value: 'MSFT' },
            { name: 'GOOGL - Alphabet Inc.', value: 'GOOGL' },
            { name: 'AMZN - Amazon.com Inc.', value: 'AMZN' },
            { name: 'META - Meta Platforms Inc.', value: 'META' },
            { name: 'TSLA - Tesla Inc.', value: 'TSLA' },
            { name: 'NFLX - Netflix Inc.', value: 'NFLX' },
            { name: 'NVDA - NVIDIA Corporation', value: 'NVDA' },

            // Other popular stocks
            { name: 'SPY - SPDR S&P 500 ETF', value: 'SPY' },
            { name: 'QQQ - Invesco QQQ Trust', value: 'QQQ' },
            { name: 'DIA - SPDR Dow Jones Industrial Average ETF', value: 'DIA' },
            { name: 'IWM - iShares Russell 2000 ETF', value: 'IWM' },

            // Banking
            { name: 'JPM - JPMorgan Chase & Co.', value: 'JPM' },
            { name: 'BAC - Bank of America Corporation', value: 'BAC' },
            { name: 'WFC - Wells Fargo & Company', value: 'WFC' },

            // Energy
            { name: 'XOM - Exxon Mobil Corporation', value: 'XOM' },
            { name: 'CVX - Chevron Corporation', value: 'CVX' },

            // Healthcare
            { name: 'JNJ - Johnson & Johnson', value: 'JNJ' },
            { name: 'UNH - UnitedHealth Group Inc.', value: 'UNH' },
            { name: 'PFE - Pfizer Inc.', value: 'PFE' },

            // Retail
            { name: 'WMT - Walmart Inc.', value: 'WMT' },
            { name: 'HD - The Home Depot Inc.', value: 'HD' },
            { name: 'PG - Procter & Gamble Co.', value: 'PG' },

            // Other notable companies
            { name: 'DIS - The Walt Disney Company', value: 'DIS' },
            { name: 'KO - The Coca-Cola Company', value: 'KO' },
            { name: 'MCD - McDonald\'s Corporation', value: 'MCD' },
            { name: 'INTC - Intel Corporation', value: 'INTC' },
            { name: 'AMD - Advanced Micro Devices Inc.', value: 'AMD' },
        ];

        // Filter suggestions based on user input
        const filtered = popularStocks.filter(stock =>
            stock.value.toLowerCase().includes(focusedValue) ||
            stock.name.toLowerCase().includes(focusedValue),
        ).slice(0, 25); // Discord limits to 25 choices

        await interaction.respond(filtered);
    },
};
