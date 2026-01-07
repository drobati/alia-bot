import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

const CURRENCY_NAME = process.env.CURRENCY_NAME || 'Sparks';
const CURRENCY_EMOJI = '💫';

const balanceCommand = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription(`Check your ${CURRENCY_NAME} balance`)
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to check balance for (moderators only)')
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log, sparksService } = context;

        if (!interaction.guild) {
            await interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
            return;
        }

        if (!sparksService) {
            await interaction.reply({
                content: `${CURRENCY_NAME} system is not available.`,
                ephemeral: true,
            });
            return;
        }

        const targetUser = interaction.options.getUser('user');
        const isCheckingOther = targetUser && targetUser.id !== interaction.user.id;

        // If checking another user, verify moderator permissions
        if (isCheckingOther) {
            const member = await interaction.guild.members.fetch(interaction.user.id);
            const hasModPermission = member.permissions.has('ModerateMembers') ||
                                     member.permissions.has('Administrator');

            if (!hasModPermission) {
                await interaction.reply({
                    content: 'You need moderator permissions to check other users\' balances.',
                    ephemeral: true,
                });
                return;
            }
        }

        const userToCheck = targetUser || interaction.user;
        const guildId = interaction.guild.id;
        const discordId = userToCheck.id;

        try {
            // Get or create user (this ensures they exist in the system)
            await sparksService.getOrCreateUser(guildId, discordId, userToCheck.username);

            // Get balance
            const balance = await sparksService.getBalance(guildId, discordId);

            if (!balance) {
                await interaction.reply({
                    content: `Could not retrieve balance for ${userToCheck.username}.`,
                    ephemeral: true,
                });
                return;
            }

            // Get recent transactions
            const transactions = await sparksService.getRecentTransactions(guildId, discordId, 5);

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(0xFFD700) // Gold color
                .setTitle(`${CURRENCY_EMOJI} ${CURRENCY_NAME} Balance`)
                .setThumbnail(userToCheck.displayAvatarURL())
                .addFields(
                    {
                        name: `${CURRENCY_EMOJI} Available`,
                        value: `**${balance.availableBalance.toLocaleString()}** ${CURRENCY_NAME}`,
                        inline: true,
                    },
                    {
                        name: '🔒 In Escrow',
                        value: `${balance.escrowBalance.toLocaleString()} ${CURRENCY_NAME}`,
                        inline: true,
                    },
                    {
                        name: '💰 Total Balance',
                        value: `${balance.currentBalance.toLocaleString()} ${CURRENCY_NAME}`,
                        inline: true,
                    },
                )
                .addFields(
                    {
                        name: '📈 Lifetime Earned',
                        value: `${balance.lifetimeEarned.toLocaleString()}`,
                        inline: true,
                    },
                    {
                        name: '📉 Lifetime Spent',
                        value: `${balance.lifetimeSpent.toLocaleString()}`,
                        inline: true,
                    },
                );

            // Add recent transactions if any
            if (transactions.length > 0) {
                const transactionLines = transactions.map(t => {
                    const sign = t.amount >= 0 ? '+' : '';
                    const typeEmoji = getTypeEmoji(t.type);
                    const timeAgo = getRelativeTime(t.createdAt);
                    return `${typeEmoji} ${sign}${t.amount} - ${t.description || t.type} (${timeAgo})`;
                });

                embed.addFields({
                    name: '📜 Recent Activity',
                    value: transactionLines.join('\n') || 'No recent activity',
                    inline: false,
                });
            }

            if (isCheckingOther) {
                embed.setFooter({ text: `Checked by ${interaction.user.username}` });
            }

            embed.setTimestamp();

            await interaction.reply({
                embeds: [embed],
                ephemeral: true, // Balance is private
            });

            log.info({
                category: 'sparks',
                action: 'balance_checked',
                guildId,
                userId: interaction.user.id,
                targetUserId: discordId,
                balance: balance.currentBalance,
            }, 'Balance checked');

        } catch (error) {
            log.error({ error }, 'Error fetching balance');
            await interaction.reply({
                content: 'An error occurred while fetching the balance.',
                ephemeral: true,
            });
        }
    },
};

function getTypeEmoji(type: string): string {
    const emojiMap: Record<string, string> = {
        'earn': '✨',
        'daily_bonus': '🌟',
        'spend': '💸',
        'escrow_in': '🔒',
        'escrow_out': '🔓',
        'refund': '↩️',
        'payout': '🎉',
        'void': '❌',
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

export default balanceCommand;
