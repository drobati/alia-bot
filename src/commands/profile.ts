import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';

export default {
    data: new SlashCommandBuilder()
        .setName('profile')
        .setDescription('View your or another user\'s engagement profile')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('User to view profile for (default: yourself)')
                .setRequired(false))
        .addBooleanOption(option =>
            option
                .setName('public')
                .setDescription('Share profile with the channel (default: private)')
                .setRequired(false)),

    async execute(interaction: any, context: Context) {
        const { log, engagementService } = context;
        const targetUser = interaction.options.getUser('user') || interaction.user;
        const isPublic = interaction.options.getBoolean('public') || false;

        try {
            await interaction.deferReply({ ephemeral: !isPublic });

            const guild = interaction.guild;
            if (!guild) {
                await interaction.editReply({
                    content: 'This command can only be used in a server.',
                });
                return;
            }

            if (!engagementService) {
                await interaction.editReply({
                    content: 'Engagement tracking is not available.',
                });
                return;
            }

            const stats = await engagementService.getUserStats(guild.id, targetUser.id);

            if (!stats) {
                const noDataMessage = targetUser.id === interaction.user.id
                    ? 'You don\'t have any engagement data yet. Start chatting to build your profile!'
                    : `${targetUser.username} doesn't have any engagement data yet.`;
                await interaction.editReply({ content: noDataMessage });
                return;
            }

            // Calculate some derived stats
            const daysSinceFirstSeen = Math.floor(
                (Date.now() - new Date(stats.firstSeen).getTime()) / (1000 * 60 * 60 * 24),
            );
            const avgMessagesPerDay = daysSinceFirstSeen > 0
                ? (stats.messageCount / daysSinceFirstSeen).toFixed(1)
                : stats.messageCount.toString();

            const lastActiveAgo = getTimeAgo(new Date(stats.lastActive));

            // Fetch the guild member to get their avatar and display name
            let member;
            try {
                member = await guild.members.fetch(targetUser.id);
            } catch {
                // Member might have left the server
            }

            const embed = new EmbedBuilder()
                .setTitle(`${getRankEmoji(stats.rank)} ${targetUser.username}'s Profile`)
                .setColor(getRankColor(stats.rank))
                .setThumbnail(targetUser.displayAvatarURL({ size: 256 }))
                .setTimestamp()
                .setFooter({ text: `Member since ${new Date(stats.firstSeen).toLocaleDateString()}` });

            embed.addFields([
                {
                    name: '📊 Stats',
                    value: [
                        `**Messages:** ${stats.messageCount.toLocaleString()}`,
                        `**Commands:** ${stats.commandCount.toLocaleString()}`,
                        `**Avg/Day:** ${avgMessagesPerDay} messages`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '🏆 Ranking',
                    value: [
                        `**Server Rank:** #${stats.rank}`,
                        `**Activity:** ${getActivityLevel(stats.messageCount)}`,
                    ].join('\n'),
                    inline: true,
                },
                {
                    name: '⏰ Activity',
                    value: [
                        `**Last Active:** ${lastActiveAgo}`,
                        `**First Seen:** ${daysSinceFirstSeen} days ago`,
                    ].join('\n'),
                    inline: true,
                },
            ]);

            // Add role info if we have the member
            if (member && member.roles.cache.size > 1) {
                const topRoles = member.roles.cache
                    .filter((role: any) => role.name !== '@everyone')
                    .sort((a: any, b: any) => b.position - a.position)
                    .first(3);

                if (topRoles && topRoles.length > 0) {
                    embed.addFields([
                        {
                            name: '🎭 Top Roles',
                            value: topRoles.map((role: any) => role.toString()).join(', '),
                            inline: false,
                        },
                    ]);
                }
            }

            await interaction.editReply({ embeds: [embed] });

            log.info('Profile command executed', {
                userId: interaction.user.id,
                targetUserId: targetUser.id,
                guildId: guild.id,
                isPublic,
            });

        } catch (error) {
            log.error('Profile command failed', {
                userId: interaction.user.id,
                error,
            });

            const errorMessage = 'Failed to load profile. Please try again later.';

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

function getRankEmoji(rank: number): string {
    switch (rank) {
        case 1: return '🥇';
        case 2: return '🥈';
        case 3: return '🥉';
        default: return '👤';
    }
}

function getRankColor(rank: number): number {
    switch (rank) {
        case 1: return 0xFFD700; // Gold
        case 2: return 0xC0C0C0; // Silver
        case 3: return 0xCD7F32; // Bronze
        default: return 0x7289DA; // Discord Blue
    }
}

function getActivityLevel(messageCount: number): string {
    if (messageCount >= 10000) {return '🔥 Legendary';}
    if (messageCount >= 5000) {return '⭐ Very Active';}
    if (messageCount >= 1000) {return '💬 Active';}
    if (messageCount >= 100) {return '👋 Regular';}
    return '🌱 New';
}

function getTimeAgo(date: Date): string {
    const seconds = Math.floor((Date.now() - date.getTime()) / 1000);

    if (seconds < 60) {return 'Just now';}
    if (seconds < 3600) {return `${Math.floor(seconds / 60)} minutes ago`;}
    if (seconds < 86400) {return `${Math.floor(seconds / 3600)} hours ago`;}
    if (seconds < 604800) {return `${Math.floor(seconds / 86400)} days ago`;}
    return date.toLocaleDateString();
}
