import {
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

interface LastSeenSlashCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _interaction: ChatInputCommandInteraction,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _context: Context,
    ): Promise<void>;
}

const lastSeenCommand: LastSeenSlashCommand = {
    data: new SlashCommandBuilder()
        .setName('lastseen')
        .setDescription('Check when someone was last seen or manage privacy settings')
        .addSubcommand(subcommand =>
            subcommand
                .setName('check')
                .setDescription('Check when a user was last seen')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('User to check last seen time for')
                        .setRequired(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('privacy')
                .setDescription('Toggle your last seen privacy setting')
                .addBooleanOption(option =>
                    option.setName('hide')
                        .setDescription('Hide your last seen time from others')
                        .setRequired(true),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'check':
                    await handleCheckLastSeen(interaction, context);
                    break;
                case 'privacy':
                    await handlePrivacySetting(interaction, context);
                    break;
                default:
                    await interaction.reply({
                        content: 'Invalid subcommand.',
                        ephemeral: true,
                    });
            }
        } catch (error) {
            log.error('Error in lastseen command:', error);
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

async function handleCheckLastSeen(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables } = context;
    const targetUser = interaction.options.getUser('user', true);

    if (targetUser.id === interaction.user.id) {
        await interaction.reply({
            content: '🤔 You want to check when you were last seen? You\'re... you\'re right here.',
            ephemeral: true,
        });
        return;
    }

    // Get target user's betting profile
    const betUser = await tables.BetUsers.findOne({
        where: { discord_id: targetUser.id },
    });

    if (!betUser) {
        await interaction.reply({
            content: `❌ ${targetUser.username} is not registered in the betting system.`,
            ephemeral: true,
        });
        return;
    }

    // Check privacy setting
    if (betUser.hide_last_seen) {
        await interaction.reply({
            content: `🔒 ${targetUser.username} has chosen to keep their last seen time private.`,
            ephemeral: true,
        });
        return;
    }

    // Get engagement stats to find last message time
    const engagementStats = await tables.BetEngagementStats.findOne({
        where: { user_id: betUser.id },
    });

    if (!engagementStats || !engagementStats.last_message_at) {
        await interaction.reply({
            content: `❓ No activity recorded for ${targetUser.username} yet.`,
            ephemeral: true,
        });
        return;
    }

    const lastSeenTime = engagementStats.last_message_at;
    const now = new Date();
    const timeDiff = now.getTime() - lastSeenTime.getTime();

    const timeString = formatTimeDifference(timeDiff);
    const channelId = engagementStats.last_message_channel_id;

    const embed = new EmbedBuilder()
        .setTitle(`👀 Last Seen: ${targetUser.username}`)
        .setColor('#0099ff')
        .setTimestamp();

    let description = `Last seen: **${timeString}**\n`;
    description += `Date: <t:${Math.floor(lastSeenTime.getTime() / 1000)}:F>\n`;

    if (channelId) {
        description += `Channel: <#${channelId}>\n`;
    }

    embed.setDescription(description);

    // Add activity stats if available
    embed.addFields(
        { name: 'Message Count', value: engagementStats.message_count.toString(), inline: true },
        { name: 'Daily Earns', value: engagementStats.daily_earn_count.toString(), inline: true },
    );

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

async function handlePrivacySetting(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables } = context;
    const hideLastSeen = interaction.options.getBoolean('hide', true);

    // Get or create user
    let user = await tables.BetUsers.findOne({
        where: { discord_id: interaction.user.id },
    });

    if (!user) {
        user = await tables.BetUsers.create({
            discord_id: interaction.user.id,
            handle: null,
            hide_last_seen: hideLastSeen,
        });

        // Create initial balance and engagement stats
        await tables.BetBalances.create({
            user_id: user.id,
            available_balance: 100, // Starting balance
            escrowed_balance: 0,
        });

        await tables.BetEngagementStats.create({
            user_id: user.id,
            message_count: 0,
            daily_earn_count: 0,
            last_reset_date: new Date().toISOString().split('T')[0], // YYYY-MM-DD format
        });

        const statusMessage = hideLastSeen ? 'hidden' : 'visible';
        await interaction.reply({
            content: `✅ Welcome to the betting system! Your last seen status is now **${
                statusMessage
            }** to other users.`,
            ephemeral: true,
        });
        return;
    }

    // Update privacy setting
    await user.update({ hide_last_seen: hideLastSeen });

    const statusMessage = hideLastSeen ? 'hidden' : 'visible';
    const privacyIcon = hideLastSeen ? '🔒' : '👀';

    await interaction.reply({
        content: `${privacyIcon} Your last seen status is now **${statusMessage}** to other users.`,
        ephemeral: true,
    });
}

function formatTimeDifference(timeDiffMs: number): string {
    const seconds = Math.floor(timeDiffMs / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);
    const weeks = Math.floor(days / 7);
    const months = Math.floor(days / 30);
    const years = Math.floor(days / 365);

    if (years > 0) {
        return `${years} year${years !== 1 ? 's' : ''} ago`;
    } else if (months > 0) {
        return `${months} month${months !== 1 ? 's' : ''} ago`;
    } else if (weeks > 0) {
        return `${weeks} week${weeks !== 1 ? 's' : ''} ago`;
    } else if (days > 0) {
        return `${days} day${days !== 1 ? 's' : ''} ago`;
    } else if (hours > 0) {
        return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    } else if (minutes > 0) {
        return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    } else if (seconds > 10) {
        return `${seconds} second${seconds !== 1 ? 's' : ''} ago`;
    } else {
        return 'Just now';
    }
}

export default lastSeenCommand;