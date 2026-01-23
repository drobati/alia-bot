import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

const hoardCommand = {
    data: new SlashCommandBuilder()
        .setName('hoard')
        .setDescription('View the greatest spice hoarders of Arrakis'),

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
                    content: 'The desert remains untouched. ' +
                        'No one has harvested spice yet. Use `/harvest` to be the first.',
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

            // Build the leaderboard with Dune-themed ranks
            const rankTitles = [
                'Emperor',      // 1st
                'Kwisatz Haderach',  // 2nd
                'Naib',         // 3rd
                'Fedaykin',     // 4th
                'Fremen',       // 5th
                'Fremen',       // 6th
                'Fremen',       // 7th
                'Fremen',       // 8th
                'Fremen',       // 9th
                'Fremen',       // 10th
            ];

            const leaderboardLines = topUsers.map((user, index) => {
                const rank = index + 1;
                const title = rankTitles[index] || 'Fremen';
                const displayName = user.username || 'Unknown User';
                const isCurrentUser = user.discord_id === interaction.user.id;
                const highlight = isCurrentUser ? ' **(You)**' : '';
                return `**${rank}.** ${displayName} — *${title}*${highlight}`;
            });

            // Build embed
            const embed = new EmbedBuilder()
                .setColor(0xD4A855) // Sandy/spice color
                .setTitle('The Spice Hoard of Arrakis')
                .setDescription(
                    '*He who controls the spice, controls the universe.*\n\n' +
                    leaderboardLines.join('\n'),
                )
                .setFooter({
                    text: userRank
                        ? `Your standing: #${userRank} of ${allUsers.length} in the sietch`
                        : 'Use /harvest to join the sietch',
                })
                .setTimestamp();

            log.info({
                category: 'spice',
                action: 'hoard_viewed',
                guildId,
                userId: interaction.user.id,
                totalUsers: allUsers.length,
            }, 'Spice hoard leaderboard viewed');

            await interaction.reply({
                embeds: [embed],
            });

        } catch (error) {
            log.error({ error }, 'Error fetching spice hoard');
            await interaction.reply({
                content: 'An error occurred while consulting the spice records.',
                ephemeral: true,
            });
        }
    },
};

export default hoardCommand;
