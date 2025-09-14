import {
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

interface BalanceSlashCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _interaction: ChatInputCommandInteraction,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _context: Context,
    ): Promise<void>;
}

const balanceCommand: BalanceSlashCommand = {
    data: new SlashCommandBuilder()
        .setName('balance')
        .setDescription('Check Sparks balance and transaction history')
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check your current Sparks balance')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check balance for (moderators only)')
                        .setRequired(false),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('history')
                .setDescription('View your transaction history')
                .addIntegerOption(option =>
                    option.setName('limit')
                        .setDescription('Number of transactions to show (max 25)')
                        .setRequired(false)
                        .setMinValue(1)
                        .setMaxValue(25),
                )
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check history for (moderators only)')
                        .setRequired(false),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'check':
                    await handleCheckBalance(interaction, context);
                    break;
                case 'history':
                    await handleTransactionHistory(interaction, context);
                    break;
                default:
                    await interaction.reply({
                        content: 'Invalid subcommand.',
                        ephemeral: true,
                    });
            }
        } catch (error) {
            log.error('Error in balance command:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true,
                });
            } else {
                await interaction.followUp({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true,
                });
            }
        }
    },
};

async function handleCheckBalance(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables } = context;
    const targetUser = interaction.options.getUser('user');
    const isModeratorCheck = targetUser && targetUser.id !== interaction.user.id;

    // Check if user is moderator for other user checks
    if (isModeratorCheck && !interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.reply({
            content: '❌ You need Manage Messages permission to check other users\' balances.',
            ephemeral: true,
        });
        return;
    }

    const discordId = targetUser?.id || interaction.user.id;
    const displayName = targetUser?.username || interaction.user.username;

    // Get or create user
    let user = await tables.BetUsers.findOne({
        where: { discord_id: discordId },
    });

    if (!user) {
        if (isModeratorCheck) {
            await interaction.reply({
                content: `❌ User ${displayName} is not registered in the betting system.`,
                ephemeral: true,
            });
            return;
        }

        // Auto-register the requesting user
        user = await tables.BetUsers.create({
            discord_id: discordId,
            handle: null,
            hide_last_seen: false,
        });

        // Create initial balance
        await tables.BetBalances.create({
            user_id: user.id,
            current_balance: 100, // Starting balance
            escrow_balance: 0,
        });
    }

    // Get balance
    let balance = await tables.BetBalances.findOne({
        where: { user_id: user.id },
    });

    if (!balance) {
        // Create balance if it doesn't exist
        balance = await tables.BetBalances.create({
            user_id: user.id,
            current_balance: 100, // Starting balance
            escrow_balance: 0,
        });
    }

    const totalBalance = balance.current_balance + balance.escrow_balance;

    const embed = new EmbedBuilder()
        .setTitle(`💰 ${displayName}'s Sparks Balance`)
        .addFields(
            { name: 'Available', value: `${balance.current_balance} Sparks`, inline: true },
            { name: 'In Escrow', value: `${balance.escrow_balance} Sparks`, inline: true },
            { name: 'Total', value: `${totalBalance} Sparks`, inline: true },
        )
        .setColor('#00ff00')
        .setTimestamp();

    if (balance.escrow_balance > 0) {
        embed.setFooter({ text: 'Escrow: Sparks locked in active bets' });
    }

    await interaction.reply({
        embeds: [embed],
        ephemeral: isModeratorCheck || targetUser?.id === interaction.user.id,
    });
}

async function handleTransactionHistory(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables } = context;
    const limit = interaction.options.getInteger('limit') || 10;
    const targetUser = interaction.options.getUser('user');
    const isModeratorCheck = targetUser && targetUser.id !== interaction.user.id;

    // Check if user is moderator for other user checks
    if (isModeratorCheck && !interaction.memberPermissions?.has('ManageMessages')) {
        await interaction.reply({
            content: '❌ You need Manage Messages permission to check other users\' transaction history.',
            ephemeral: true,
        });
        return;
    }

    const discordId = targetUser?.id || interaction.user.id;
    const displayName = targetUser?.username || interaction.user.username;

    // Get user
    const user = await tables.BetUsers.findOne({
        where: { discord_id: discordId },
    });

    if (!user) {
        await interaction.reply({
            content: `❌ ${isModeratorCheck ? `User ${displayName}` : 'You'} ${
                isModeratorCheck ? 'is' : 'are'
            } not registered in the betting system.`,
            ephemeral: true,
        });
        return;
    }

    // Get transaction history
    const transactions = await tables.BetLedger.findAll({
        where: { user_id: user.id },
        order: [['created_at', 'DESC']],
        limit,
    });

    if (transactions.length === 0) {
        await interaction.reply({
            content: `📊 No transaction history found for ${isModeratorCheck ? displayName : 'you'}.`,
            ephemeral: true,
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle(`📊 ${displayName}'s Transaction History`)
        .setColor('#0099ff')
        .setTimestamp();

    let description = '';
    for (const transaction of transactions) {
        const date = transaction.created_at!.toLocaleDateString();
        const time = transaction.created_at!.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        const typeIcon = getTransactionIcon(transaction.type);
        const sign = getTransactionSign(transaction.type);

        description += `${typeIcon} **${
            transaction.type.replace('_', ' ').toUpperCase()
        }** ${sign}${transaction.amount} Sparks\n`;
        description += `*${date} at ${time}*\n`;

        if (transaction.ref_type && transaction.ref_id) {
            description += `Related to: ${transaction.ref_type} ${transaction.ref_id.substring(0, 8)}...\n`;
        }

        description += '\n';
    }

    if (description.length > 4096) {
        description = description.substring(0, 4090) + '...';
    }

    embed.setDescription(description);

    // Add summary footer
    const totalEarned = transactions
        .filter((t: any) => ['earn', 'payout', 'refund'].includes(t.type))
        .reduce((sum: number, t: any) => sum + t.amount, 0);

    const totalSpent = transactions
        .filter((t: any) => ['spend', 'escrow_in'].includes(t.type))
        .reduce((sum: number, t: any) => sum + t.amount, 0);

    embed.setFooter({
        text: `Showing ${transactions.length} of latest transactions | ` +
            `Total earned: ${totalEarned} | Total spent: ${totalSpent}`,
    });

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

function getTransactionIcon(type: string): string {
    switch (type) {
        case 'earn': return '💰';
        case 'spend': return '💸';
        case 'escrow_in': return '🔒';
        case 'escrow_out': return '🔓';
        case 'refund': return '↩️';
        case 'payout': return '🎉';
        case 'void': return '❌';
        default: return '📝';
    }
}

function getTransactionSign(type: string): string {
    switch (type) {
        case 'earn':
        case 'payout':
        case 'refund':
        case 'escrow_out':
            return '+';
        case 'spend':
        case 'escrow_in':
        case 'void':
            return '-';
        default:
            return '';
    }
}

export default balanceCommand;