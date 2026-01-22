import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

const wealthCommand = {
    data: new SlashCommandBuilder()
        .setName('wealth')
        .setDescription('View the wealthiest spice holders (rankings only, no balances shown)'),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { tables, log } = context;

        if (!interaction.guild) {
            await interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
            return;
        }

        const guildId = interaction.guild.id;

        try {
            // Get top 10 users by balance
            const topUsers = await tables.SpiceBalance.findAll({
                where: { guild_id: guildId },
                order: [['current_balance', 'DESC']],
                limit: 10,
            });

            if (topUsers.length === 0) {
                await interaction.reply({
                    content: 'No one has harvested any spice yet! Use `/harvest` to be the first.',
                    ephemeral: false,
                });
                return;
            }

            // Find the requesting user's rank
            let userRank: number | null = null;
            const allUsers = await tables.SpiceBalance.findAll({
                where: { guild_id: guildId },
                order: [['current_balance', 'DESC']],
            });

            for (let i = 0; i < allUsers.length; i++) {
                if (allUsers[i].discord_id === interaction.user.id) {
                    userRank = i + 1;
                    break;
                }
            }

            // Build the leaderboard
            const rankEmojis = ['', '', '', '4.', '5.', '6.', '7.', '8.', '9.', '10.'];
            const leaderboardLines = topUsers.map((user, index) => {
                const rank = rankEmojis[index] || `${index + 1}.`;
                const displayName = user.username || 'Unknown User';
                const isCurrentUser = user.discord_id === interaction.user.id;
                const highlight = isCurrentUser ? ' **(You)**' : '';
                return `${rank} ${displayName}${highlight}`;
            });

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(0xD4A855) // Sandy/spice color
                .setTitle('Spice Wealth Rankings')
                .setDescription(
                    '*The wealthiest spice traders in the desert*\n\n' +
                    leaderboardLines.join('\n'),
                )
                .setFooter({
                    text: userRank
                        ? `Your rank: #${userRank} of ${allUsers.length}`
                        : 'Use /harvest to join the rankings',
                })
                .setTimestamp();

            log.info({
                category: 'spice',
                action: 'wealth_viewed',
                guildId,
                userId: interaction.user.id,
                totalUsers: allUsers.length,
            }, 'Wealth leaderboard viewed');

            await interaction.reply({
                embeds: [embed],
            });

        } catch (error) {
            log.error({ error }, 'Error fetching wealth rankings');
            await interaction.reply({
                content: 'An error occurred while fetching the wealth rankings.',
                ephemeral: true,
            });
        }
    },
};

export default wealthCommand;
