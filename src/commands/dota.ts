import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import opendota from "../lib/apis/opendota";

// Timeframe options for leaderboard
const TIMEFRAMES: Record<string, { days: number; label: string }> = {
    week: { days: 7, label: 'Past Week' },
    month: { days: 30, label: 'Past Month' },
    all: { days: 0, label: 'All Time' },
};

async function handleRegister(interaction: any, { tables, log }: any) {
    const steamIdInput = interaction.options.getString('steam_id');
    const discordId = interaction.user.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    try {
        // Normalize the Steam ID (convert 64-bit to 32-bit if needed)
        const steamId = opendota.normalizeSteamId(steamIdInput);

        // Check if user is already registered in this guild
        const existing = await tables.DotaUsers.findOne({
            where: { discord_id: discordId, guild_id: guildId },
        });

        if (existing) {
            await interaction.reply({
                content: `You are already registered with Steam ID: ${existing.steam_id}. ` +
                    'Use `/dota unregister` first if you want to change it.',
                ephemeral: true,
            });
            return;
        }

        // Validate Steam ID with OpenDota API
        await interaction.deferReply({ ephemeral: true });

        const playerData = await opendota.getPlayer(steamId);

        if (!playerData || !playerData.profile) {
            await interaction.editReply({
                content: 'Could not find a Dota 2 player with that Steam ID. ' +
                    'Make sure you\'re using your Steam 32-bit or 64-bit ID.',
            });
            return;
        }

        // Store in database
        await tables.DotaUsers.create({
            discord_id: discordId,
            guild_id: guildId,
            steam_id: steamId,
            steam_username: playerData.profile.personaname,
        });

        log.info({ discordId, steamId, guildId, category: 'dota' }, 'User registered for Dota leaderboard');

        await interaction.editReply({
            content: `Successfully registered as **${playerData.profile.personaname}** (Steam ID: ${steamId})`,
        });
    } catch (error) {
        log.error({ err: error, discordId, steamIdInput, category: 'dota' }, 'Error registering Dota user');
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while registering. Please try again later.',
            });
        } else {
            await interaction.reply({
                content: 'An error occurred while registering. Please try again later.',
                ephemeral: true,
            });
        }
    }
}

async function handleUnregister(interaction: any, { tables, log }: any) {
    const discordId = interaction.user.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    try {
        const record = await tables.DotaUsers.findOne({
            where: { discord_id: discordId, guild_id: guildId },
        });

        if (!record) {
            await interaction.reply({
                content: 'You are not registered. Use `/dota register` to register your Steam ID.',
                ephemeral: true,
            });
            return;
        }

        const username = record.steam_username;
        await record.destroy({ force: true });

        log.info({ discordId, guildId, category: 'dota' }, 'User unregistered from Dota leaderboard');

        await interaction.reply({
            content: `Successfully unregistered **${username}** from the Dota leaderboard.`,
            ephemeral: true,
        });
    } catch (error) {
        log.error({ err: error, discordId, category: 'dota' }, 'Error unregistering Dota user');
        await interaction.reply({
            content: 'An error occurred while unregistering. Please try again later.',
            ephemeral: true,
        });
    }
}

async function handleProfile(interaction: any, { tables, log }: any) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const discordId = targetUser.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    try {
        const record = await tables.DotaUsers.findOne({
            where: { discord_id: discordId, guild_id: guildId },
        });

        if (!record) {
            const isOwnProfile = targetUser.id === interaction.user.id;
            await interaction.reply({
                content: isOwnProfile
                    ? 'You are not registered. Use `/dota register` to register your Steam ID.'
                    : `${targetUser.username} is not registered for the Dota leaderboard.`,
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        // Fetch player data from OpenDota
        const [playerData, wlAll, wlMonth, wlWeek] = await Promise.all([
            opendota.getPlayer(record.steam_id),
            opendota.getWinLoss(record.steam_id),
            opendota.getWinLoss(record.steam_id, { date: 30 }),
            opendota.getWinLoss(record.steam_id, { date: 7 }),
        ]);

        if (!playerData || !playerData.profile) {
            await interaction.editReply({
                content: 'Could not fetch player data from OpenDota. The profile might be private.',
            });
            return;
        }

        const calcWinRate = (wl: { win: number; lose: number } | null) => {
            if (!wl || (wl.win + wl.lose) === 0) {return 'N/A';}
            return ((wl.win / (wl.win + wl.lose)) * 100).toFixed(1) + '%';
        };

        const embed = new EmbedBuilder()
            .setTitle(`🎮 ${playerData.profile.personaname}`)
            .setURL(playerData.profile.profileurl)
            .setThumbnail(playerData.profile.avatarfull)
            .setColor(0x1a1a2e)
            .addFields([
                {
                    name: '📊 All Time',
                    value: wlAll ? `${wlAll.win}W / ${wlAll.lose}L (${calcWinRate(wlAll)})` : 'No data',
                    inline: true,
                },
                {
                    name: '📅 Past Month',
                    value: wlMonth ? `${wlMonth.win}W / ${wlMonth.lose}L (${calcWinRate(wlMonth)})` : 'No data',
                    inline: true,
                },
                {
                    name: '📆 Past Week',
                    value: wlWeek ? `${wlWeek.win}W / ${wlWeek.lose}L (${calcWinRate(wlWeek)})` : 'No data',
                    inline: true,
                },
            ]);

        // Add MMR estimate if available
        if (playerData.mmr_estimate?.estimate) {
            embed.addFields([{
                name: '🏆 Estimated MMR',
                value: playerData.mmr_estimate.estimate.toString(),
                inline: true,
            }]);
        }

        // Add rank tier if available
        if (playerData.rank_tier) {
            const medals = ['', 'Herald', 'Guardian', 'Crusader', 'Archon', 'Legend', 'Ancient', 'Divine', 'Immortal'];
            const medalIndex = Math.floor(playerData.rank_tier / 10);
            const stars = playerData.rank_tier % 10;
            const medalName = medals[medalIndex] || 'Unknown';
            embed.addFields([{
                name: '🎖️ Rank',
                value: `${medalName} ${stars > 0 ? stars : ''}`,
                inline: true,
            }]);
        }

        embed.setFooter({ text: `Steam ID: ${record.steam_id}` });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        log.error({ err: error, discordId, category: 'dota' }, 'Error fetching Dota profile');
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while fetching the profile. Please try again later.',
            });
        } else {
            await interaction.reply({
                content: 'An error occurred while fetching the profile. Please try again later.',
                ephemeral: true,
            });
        }
    }
}

async function handleLeaderboard(interaction: any, { tables, log }: any) {
    const timeframeKey = interaction.options.getString('timeframe') || 'month';
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const timeframe = TIMEFRAMES[timeframeKey];

    try {
        // Get all registered users in this guild
        const users = await tables.DotaUsers.findAll({
            where: { guild_id: guildId },
        });

        if (users.length === 0) {
            await interaction.reply({
                content: 'No users are registered for the Dota leaderboard yet. Use `/dota register` to be the first!',
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        // Fetch win/loss for each user
        const playerStats: Array<{
            discordId: string;
            steamUsername: string;
            wins: number;
            losses: number;
            winRate: number;
            totalGames: number;
        }> = [];

        // Fetch stats for each player (with rate limiting consideration)
        for (const user of users) {
            try {
                const wl = timeframe.days > 0
                    ? await opendota.getWinLoss(user.steam_id, { date: timeframe.days })
                    : await opendota.getWinLoss(user.steam_id);

                if (wl && (wl.win + wl.lose) > 0) {
                    playerStats.push({
                        discordId: user.discord_id,
                        steamUsername: user.steam_username || 'Unknown',
                        wins: wl.win,
                        losses: wl.lose,
                        winRate: (wl.win / (wl.win + wl.lose)) * 100,
                        totalGames: wl.win + wl.lose,
                    });
                }
            } catch (err) {
                log.warn({ err, steamId: user.steam_id, category: 'dota' }, 'Failed to fetch stats for user');
            }
        }

        if (playerStats.length === 0) {
            await interaction.editReply({
                content: `No players have games recorded for ${timeframe.label.toLowerCase()}. Play some Dota!`,
            });
            return;
        }

        // Sort by win rate (with minimum games filter for fairness)
        const MIN_GAMES = 5;
        const qualifiedPlayers = playerStats.filter(p => p.totalGames >= MIN_GAMES);
        const unqualifiedPlayers = playerStats.filter(p => p.totalGames < MIN_GAMES);

        // Sort qualified by win rate, unqualified by total games
        qualifiedPlayers.sort((a, b) => b.winRate - a.winRate);
        unqualifiedPlayers.sort((a, b) => b.totalGames - a.totalGames);

        const embed = new EmbedBuilder()
            .setTitle(`🏆 Dota 2 Leaderboard - ${timeframe.label}`)
            .setColor(0xffd700)
            .setDescription(`Ranked by win rate (minimum ${MIN_GAMES} games)`);

        // Build leaderboard string
        let leaderboardText = '';
        const medals = ['🥇', '🥈', '🥉'];

        qualifiedPlayers.slice(0, 10).forEach((player, index) => {
            const medal = medals[index] || `${index + 1}.`;
            const winRate = player.winRate.toFixed(1);
            leaderboardText += `${medal} **${player.steamUsername}** - ` +
                `${winRate}% (${player.wins}W/${player.losses}L)\n`;
        });

        if (leaderboardText) {
            embed.addFields([{
                name: '📊 Rankings',
                value: leaderboardText || 'No qualified players',
                inline: false,
            }]);
        }

        // Add unqualified players section if any
        if (unqualifiedPlayers.length > 0) {
            let unqualifiedText = '';
            unqualifiedPlayers.slice(0, 5).forEach(player => {
                const winRate = player.winRate.toFixed(1);
                unqualifiedText += `• ${player.steamUsername} - ` +
                    `${player.totalGames} games (${winRate}%)\n`;
            });
            embed.addFields([{
                name: `⏳ Need ${MIN_GAMES}+ games to qualify`,
                value: unqualifiedText,
                inline: false,
            }]);
        }

        embed.setFooter({ text: `${playerStats.length} registered players • ${qualifiedPlayers.length} qualified` });

        await interaction.editReply({ embeds: [embed] });

    } catch (error) {
        log.error({ err: error, guildId, category: 'dota' }, 'Error generating Dota leaderboard');
        if (interaction.deferred) {
            await interaction.editReply({
                content: 'An error occurred while generating the leaderboard. Please try again later.',
            });
        } else {
            await interaction.reply({
                content: 'An error occurred while generating the leaderboard. Please try again later.',
                ephemeral: true,
            });
        }
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('dota')
        .setDescription('Dota 2 leaderboard commands')
        .addSubcommand((subcommand: any) => subcommand
            .setName('register')
            .setDescription('Register your Steam ID for the Dota leaderboard')
            .addStringOption((option: any) => option
                .setName('steam_id')
                .setDescription('Your Steam ID (32-bit or 64-bit)')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('unregister')
            .setDescription('Remove yourself from the Dota leaderboard'))
        .addSubcommand((subcommand: any) => subcommand
            .setName('profile')
            .setDescription('View Dota 2 profile and stats')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('User to view (defaults to yourself)')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('leaderboard')
            .setDescription('View the server Dota 2 leaderboard')
            .addStringOption((option: any) => option
                .setName('timeframe')
                .setDescription('Time period for stats')
                .setRequired(false)
                .addChoices(
                    { name: 'Past Week', value: 'week' },
                    { name: 'Past Month', value: 'month' },
                    { name: 'All Time', value: 'all' },
                ))),
    async execute(interaction: any, context: any) {
        const action = interaction.options.getSubcommand();
        switch (action) {
            case 'register':
                await handleRegister(interaction, context);
                break;
            case 'unregister':
                await handleUnregister(interaction, context);
                break;
            case 'profile':
                await handleProfile(interaction, context);
                break;
            case 'leaderboard':
                await handleLeaderboard(interaction, context);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    ephemeral: true,
                });
                break;
        }
    },
};
