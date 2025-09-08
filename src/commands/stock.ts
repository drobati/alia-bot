import { SlashCommandBuilder, EmbedBuilder, CommandInteraction } from 'discord.js';
import { Context } from '../utils/types';
import { PolygonService } from '../utils/polygon-service';
import { checkOwnerPermission } from '../utils/permissions';

// Initialize Polygon service - will be done once per import
let polygonService: PolygonService | null = null;

function getPolygonService(context: Context): PolygonService {
    if (!polygonService) {
        polygonService = new PolygonService(context.log);
    }
    return polygonService;
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
                )
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
                ephemeral: true
            });
            return;
        }

        // Get the ticker symbol
        const ticker = interaction.options.getString('ticker');
        
        if (!ticker) {
            await interaction.reply({
                content: 'Please provide a ticker symbol. Example: `/stock get AAPL`',
                ephemeral: true
            });
            return;
        }

        // Validate ticker format (basic validation)
        const tickerRegex = /^[A-Za-z]{1,10}$/;
        if (!tickerRegex.test(ticker)) {
            await interaction.reply({
                content: 'Invalid ticker format. Please use 1-10 letters only (e.g., AAPL, MSFT).',
                ephemeral: true
            });
            return;
        }

        log.info(`Stock command executed by ${interaction.user.username} for ticker: ${ticker.toUpperCase()}`);

        // Defer reply since API call might take time
        await interaction.deferReply({ ephemeral: false });

        try {
            // Get Polygon service and fetch stock data
            const service = getPolygonService(context);
            const stockData = await service.getStockQuote(ticker);

            if (!stockData) {
                await interaction.editReply({
                    content: `❌ Could not find stock data for ticker: **${ticker.toUpperCase()}**\n\nPlease check that the ticker symbol is correct and that it's traded on US exchanges.`
                });
                return;
            }

            // Create embed with stock data
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
                    inline: true
                },
                {
                    name: `${changeEmoji} Change`,
                    value: `${changePrefix}$${stockData.change.toFixed(2)}\n${changePrefix}${stockData.changePercent.toFixed(2)}%`,
                    inline: true
                },
                {
                    name: '📊 Volume',
                    value: stockData.volume.toLocaleString(),
                    inline: true
                },
                {
                    name: '🔺 High',
                    value: `$${stockData.high.toFixed(2)}`,
                    inline: true
                },
                {
                    name: '🔻 Low', 
                    value: `$${stockData.low.toFixed(2)}`,
                    inline: true
                },
                {
                    name: '🏁 Previous Close',
                    value: `$${stockData.previousClose.toFixed(2)}`,
                    inline: true
                }
            );

            // Market status
            const marketStatus = stockData.isMarketOpen ? '🟢 Market Open' : '🔴 Market Closed';
            embed.setFooter({ 
                text: `${marketStatus} • Data from Polygon.io • ${new Date(stockData.timestamp).toLocaleString()}`
            });

            // Rate limiting info for transparency
            const rateLimitStatus = service.getRateLimitStatus();
            if (rateLimitStatus.remaining <= 1) {
                embed.setDescription('⚠️ *API rate limit approaching. Responses may be slower for the next few minutes.*');
            }

            await interaction.editReply({
                embeds: [embed]
            });

            log.info(`Successfully provided stock data for ${stockData.symbol}: $${stockData.price}`);

        } catch (error) {
            log.error('Error in stock command execution', {
                ticker,
                user: interaction.user.username,
                error: error instanceof Error ? error.message : 'Unknown error'
            });

            await interaction.editReply({
                content: `❌ **Error fetching stock data for ${ticker.toUpperCase()}**\n\nThis could be due to:\n• Invalid ticker symbol\n• API rate limiting\n• Network issues\n• Market data unavailable\n\nPlease try again in a few minutes.`
            });
        }
    }
};