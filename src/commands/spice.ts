import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

const HARVEST_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour in milliseconds

const spiceCommand = {
    data: new SlashCommandBuilder()
        .setName('spice')
        .setDescription('Check your spice balance')
        .addBooleanOption(option =>
            option
                .setName('public')
                .setDescription('Make the result visible to everyone (default: private)')
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { tables, log } = context;

        if (!interaction.guild) {
            await interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
            return;
        }

        const isPublic = interaction.options.getBoolean('public') ?? false;
        const guildId = interaction.guild.id;
        const discordId = interaction.user.id;
        const username = interaction.user.username;

        try {
            // Get or create user balance
            const [balance] = await tables.SpiceBalance.findOrCreate({
                where: { guild_id: guildId, discord_id: discordId },
                defaults: {
                    guild_id: guildId,
                    discord_id: discordId,
                    username: username,
                    current_balance: 0,
                    last_harvest_at: null,
                    lifetime_harvested: 0,
                    lifetime_given: 0,
                    lifetime_received: 0,
                },
            });

            // Calculate time until next harvest and accumulated spice
            let harvestStatus = 'The desert awaits!';
            if (balance.last_harvest_at) {
                const lastHarvest = new Date(balance.last_harvest_at);
                const now = new Date();
                const timeSinceHarvest = now.getTime() - lastHarvest.getTime();

                if (timeSinceHarvest < HARVEST_COOLDOWN_MS) {
                    const remainingMs = HARVEST_COOLDOWN_MS - timeSinceHarvest;
                    const remainingMins = Math.ceil(remainingMs / 60000);
                    harvestStatus = `${remainingMins} min${remainingMins !== 1 ? 's' : ''} until harvest`;
                } else {
                    // Show accumulated spice available
                    const hoursAccumulated = Math.floor(timeSinceHarvest / HARVEST_COOLDOWN_MS);
                    const accumulatedSpice = hoursAccumulated * 10;
                    harvestStatus = `**${accumulatedSpice} spice** accumulated`;
                }
            }

            // Get recent transactions
            const recentTransactions = await tables.SpiceLedger.findAll({
                where: { guild_id: guildId, discord_id: discordId },
                order: [['created_at', 'DESC']],
                limit: 5,
            });

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(0xD4A855) // Sandy/spice color
                .setTitle('Your Spice Reserves')
                .setThumbnail(interaction.user.displayAvatarURL())
                .addFields(
                    {
                        name: 'Current Holdings',
                        value: `**${balance.current_balance.toLocaleString()}** spice`,
                        inline: true,
                    },
                    {
                        name: 'Desert Status',
                        value: harvestStatus,
                        inline: true,
                    },
                )
                .addFields(
                    {
                        name: 'Lifetime Harvested',
                        value: `${balance.lifetime_harvested.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: 'Tribute Paid',
                        value: `${balance.lifetime_given.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: 'Tribute Received',
                        value: `${balance.lifetime_received.toLocaleString()}`,
                        inline: true,
                    },
                );

            // Add recent transactions if any
            if (recentTransactions.length > 0) {
                const transactionLines = recentTransactions.map(t => {
                    const sign = t.amount >= 0 ? '+' : '';
                    const typeEmoji = getTypeEmoji(t.type);
                    const timeAgo = t.created_at ? getRelativeTime(t.created_at) : 'unknown';
                    return `${typeEmoji} ${sign}${t.amount} - ${t.description || t.type} (${timeAgo})`;
                });

                embed.addFields({
                    name: 'Recent Activity',
                    value: transactionLines.join('\n') || 'No recent activity',
                    inline: false,
                });
            }

            embed.setTimestamp();

            log.info({
                category: 'spice',
                action: 'balance_checked',
                guildId,
                userId: discordId,
                balance: balance.current_balance,
            }, 'Spice balance checked');

            await interaction.reply({
                embeds: [embed],
                ephemeral: !isPublic,
            });

        } catch (error) {
            log.error({ error }, 'Error checking spice balance');
            await interaction.reply({
                content: 'An error occurred while checking your balance.',
                ephemeral: true,
            });
        }
    },
};

function getTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
        'harvest': '🏜️',
        'tribute_paid': '📤',
        'tribute_received': '📥',
        // Legacy support for old ledger entries
        'give_sent': '📤',
        'give_received': '📥',
    };
    return emojiMap[type] || '•';
}

function getRelativeTime(date: Date): string {
    const now = new Date();
    const diffMs = now.getTime() - new Date(date).getTime();
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMs / 3600000);
    const diffDays = Math.floor(diffMs / 86400000);

    if (diffMins < 1) {return 'just now';}
    if (diffMins < 60) {return `${diffMins}m ago`;}
    if (diffHours < 24) {return `${diffHours}h ago`;}
    if (diffDays < 7) {return `${diffDays}d ago`;}
    return new Date(date).toLocaleDateString();
}

export default spiceCommand;
