import { EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';

export default {
    data: new SlashCommandBuilder()
        .setName('leaderboard')
        .setDescription('Display server engagement leaderboard')
        .addStringOption(option =>
            option
                .setName('sort')
                .setDescription('Sort leaderboard by')
                .setRequired(false)
                .addChoices(
                    { name: 'Messages', value: 'messages' },
                    { name: 'Commands', value: 'commands' },
                ))
        .addIntegerOption(option =>
            option
                .setName('limit')
                .setDescription('Number of users to show (default: 10, max: 25)')
                .setRequired(false)
                .setMinValue(5)
                .setMaxValue(25))
        .addBooleanOption(option =>
            option
                .setName('public')
                .setDescription('Share leaderboard with the channel (default: private)')
                .setRequired(false)),

    async execute(interaction: any, context: Context) {
        const { log, engagementService } = context;
        const sortBy = interaction.options.getString('sort') || 'messages';
        const limit = interaction.options.getInteger('limit') || 10;
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

            const leaderboard = await engagementService.getLeaderboard(guild.id, limit);

            if (leaderboard.length === 0) {
                await interaction.editReply({
                    content: 'No engagement data available yet. Start chatting to build the leaderboard!',
                });
                return;
            }

            // Sort by the selected metric
            const sortedLeaderboard = [...leaderboard].sort((a, b) => {
                if (sortBy === 'commands') {
                    return b.commandCount - a.commandCount;
                }
                return b.messageCount - a.messageCount;
            });

            const embed = new EmbedBuilder()
                .setTitle(`${getMedalEmoji(0)} ${guild.name} Leaderboard`)
                .setDescription(sortBy === 'commands' ? 'Sorted by command usage' : 'Sorted by message count')
                .setColor(0xFFD700)
                .setThumbnail(guild.iconURL({ size: 128 }) || null)
                .setTimestamp()
                .setFooter({ text: `Top ${sortedLeaderboard.length} members` });

            const leaderboardText = sortedLeaderboard.map((user, index) => {
                const medal = getMedalEmoji(index);
                const rank = index + 1;
                const primaryStat = sortBy === 'commands' ? user.commandCount : user.messageCount;
                const secondaryStat = sortBy === 'commands' ? user.messageCount : user.commandCount;
                const primaryLabel = sortBy === 'commands' ? 'cmds' : 'msgs';
                const secondaryLabel = sortBy === 'commands' ? 'msgs' : 'cmds';

                const stats = `${primaryStat.toLocaleString()} ${primaryLabel}`;
                const secondary = `${secondaryStat.toLocaleString()} ${secondaryLabel}`;
                return `${medal} **#${rank}** ${user.username}\n   ${stats} | ${secondary}`;
            }).join('\n\n');

            embed.addFields([
                {
                    name: '\u200B',
                    value: leaderboardText,
                    inline: false,
                },
            ]);

            // Add user's own rank if not in top list
            const userStats = await engagementService.getUserStats(guild.id, interaction.user.id);
            if (userStats && userStats.rank > limit) {
                const msgs = userStats.messageCount.toLocaleString();
                const cmds = userStats.commandCount.toLocaleString();
                embed.addFields([
                    {
                        name: 'Your Position',
                        value: `**#${userStats.rank}** with ${msgs} messages and ${cmds} commands`,
                        inline: false,
                    },
                ]);
            }

            await interaction.editReply({ embeds: [embed] });

            log.info('Leaderboard command executed', {
                userId: interaction.user.id,
                guildId: guild.id,
                sortBy,
                limit,
                isPublic,
            });

        } catch (error) {
            log.error('Leaderboard command failed', {
                userId: interaction.user.id,
                error,
            });

            const errorMessage = 'Failed to generate leaderboard. Please try again later.';

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

function getMedalEmoji(index: number): string {
    switch (index) {
        case 0: return '🥇';
        case 1: return '🥈';
        case 2: return '🥉';
        default: return '🏅';
    }
}
