import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import opendota, { ModePreset } from "../lib/apis/opendota";
import { checkOwnerPermission } from "../utils/permissions";
import { Op } from "sequelize";
import { HERO_POSITIONS } from "../lib/dota-positions";

// Valid positions for hero filtering
const VALID_POSITIONS = ['pos1', 'pos2', 'pos3', 'pos4', 'pos5'] as const;
type Position = typeof VALID_POSITIONS[number];

// Attribute display labels
const ATTR_LABELS: Record<string, string> = {
    str: 'Strength',
    agi: 'Agility',
    int: 'Intelligence',
    all: 'Universal',
};

// Position display labels
const POSITION_LABELS: Record<Position, string> = {
    pos1: 'Position 1 (Carry)',
    pos2: 'Position 2 (Mid)',
    pos3: 'Position 3 (Offlane)',
    pos4: 'Position 4 (Soft Support)',
    pos5: 'Position 5 (Hard Support)',
};

// Help text for the /dota help command
const HELP_TEXT = {
    title: 'Dota 2 Commands - Setup Guide',
    description: 'To use Dota commands, you need to register your Steam ID and enable public match data.',
    setup: [
        '**Step 1: Enable Public Match Data**',
        '• Open Dota 2 and go to Settings > Options > Advanced Options',
        '• Enable "Expose Public Match Data"',
        '• This allows OpenDota to track your matches',
        '',
        '**Step 2: Find Your Steam ID**',
        '• Go to your Steam profile in a browser',
        '• Your Steam ID is in the URL: `steamcommunity.com/profiles/[STEAM_ID]`',
        '• Or use a site like steamid.io to look it up',
        '• Both 32-bit and 64-bit Steam IDs work',
        '',
        '**Step 3: Register with the Bot**',
        '• Use `/dota register <steam_id>` with your Steam ID',
        '• The bot will verify your account exists',
        '',
        '**Step 4: Parse Your Matches (Optional)**',
        '• Visit opendota.com and log in with Steam',
        '• Click "Refresh" to parse your recent matches',
        '• This gives you more detailed stats',
    ].join('\n'),
    commands: [
        '`/dota register` - Link your Steam account',
        '`/dota unregister` - Unlink your account',
        '`/dota profile` - View your stats',
        '`/dota leaderboard` - Server rankings',
        '`/dota heroes` - Your most played heroes',
        '`/dota recent` - Recent match history',
        '`/dota totals` - Lifetime statistics',
        '`/dota peers` - Top teammates',
        '`/dota match` - Look up any match',
        '`/dota compare` - Compare two players',
        '`/dota random` - Pick a random hero',
        '`/dota steamid` - Look up someone\'s Steam ID',
    ].join('\n'),
};

// Timeframe options for leaderboard
const TIMEFRAMES: Record<string, { days: number; label: string }> = {
    week: { days: 7, label: 'Past Week' },
    month: { days: 30, label: 'Past Month' },
    all: { days: 0, label: 'All Time' },
};

// Game mode options for profile/leaderboard
const GAME_MODE_LABELS: Record<ModePreset, string> = {
    all: 'All Modes (incl. Turbo)',
    ranked: 'Ranked Only',
};

// Helper to get significant param from preset
const getModeOptions = (preset: ModePreset): { significant: number } => opendota.MODE_PRESETS[preset];

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
    const modeKey = (interaction.options.getString('mode') || 'all') as ModePreset;
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

        const modeOptions = getModeOptions(modeKey);
        const modeLabel = GAME_MODE_LABELS[modeKey];

        // Fetch player data from OpenDota
        const [playerData, wlAll, wlMonth, wlWeek] = await Promise.all([
            opendota.getPlayer(record.steam_id),
            opendota.getWinLoss(record.steam_id, { ...modeOptions }),
            opendota.getWinLoss(record.steam_id, { date: 30, ...modeOptions }),
            opendota.getWinLoss(record.steam_id, { date: 7, ...modeOptions }),
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
            .setDescription(`**Game Mode:** ${modeLabel}`)
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
    const modeKey = (interaction.options.getString('mode') || 'all') as ModePreset;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({
            content: 'This command can only be used in a server.',
            ephemeral: true,
        });
        return;
    }

    const timeframe = TIMEFRAMES[timeframeKey];
    const modeOptions = getModeOptions(modeKey);
    const modeLabel = GAME_MODE_LABELS[modeKey];

    try {
        // Get all registered users in this guild
        const users = await tables.DotaUsers.findAll({
            where: { guild_id: guildId },
        });

        if (users.length === 0) {
            await interaction.reply({
                content: 'No users are registered for the Dota leaderboard yet. ' +
                    'Use `/dota register` to be the first!',
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
                const options = timeframe.days > 0
                    ? { date: timeframe.days, ...modeOptions }
                    : { ...modeOptions };
                const wl = await opendota.getWinLoss(user.steam_id, options);

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
                content: `No players have ${modeLabel} games recorded for ` +
                    `${timeframe.label.toLowerCase()}. Play some Dota!`,
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
            .setDescription(`**Mode:** ${modeLabel} | Ranked by win rate (minimum ${MIN_GAMES} games)`);

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

async function handleHeroes(interaction: any, { tables, log }: any) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const discordId = targetUser.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    try {
        const record = await tables.DotaUsers.findOne({
            where: { discord_id: discordId, guild_id: guildId },
        });

        if (!record) {
            const isOwn = targetUser.id === interaction.user.id;
            await interaction.reply({
                content: isOwn
                    ? 'You are not registered. Use `/dota register` to register your Steam ID.'
                    : `${targetUser.username} is not registered for the Dota leaderboard.`,
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        const [heroes, playerData] = await Promise.all([
            opendota.getHeroes(record.steam_id, { significant: 0 }),
            opendota.getPlayer(record.steam_id),
        ]);

        // Filter to heroes with games and sort by games played
        const playedHeroes = heroes
            .filter(h => h.games > 0)
            .sort((a, b) => b.games - a.games)
            .slice(0, 10);

        if (playedHeroes.length === 0) {
            await interaction.editReply({ content: 'No hero data found.' });
            return;
        }

        // Get hero names
        const heroNames = await Promise.all(
            playedHeroes.map(h => opendota.getHeroName(h.hero_id)),
        );

        const embed = new EmbedBuilder()
            .setTitle(`🦸 ${playerData?.profile?.personaname || 'Player'}'s Top Heroes`)
            .setColor(0x7c4dff)
            .setThumbnail(playerData?.profile?.avatarfull || '');

        let heroText = '';
        playedHeroes.forEach((hero, i) => {
            const winRate = hero.games > 0 ? ((hero.win / hero.games) * 100).toFixed(1) : '0';
            const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
            heroText += `${medal} **${heroNames[i]}** - ${hero.games} games (${winRate}% WR)\n`;
        });

        embed.addFields([{ name: '📊 Most Played', value: heroText, inline: false }]);
        embed.setFooter({ text: `Steam ID: ${record.steam_id}` });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, discordId, category: 'dota' }, 'Error fetching heroes');
        const reply = { content: 'An error occurred while fetching hero data.', ephemeral: true };
        interaction.deferred ? await interaction.editReply(reply) : await interaction.reply(reply);
    }
}

async function handleRecent(interaction: any, { tables, log }: any) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const discordId = targetUser.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    try {
        const record = await tables.DotaUsers.findOne({
            where: { discord_id: discordId, guild_id: guildId },
        });

        if (!record) {
            const isOwn = targetUser.id === interaction.user.id;
            await interaction.reply({
                content: isOwn
                    ? 'You are not registered. Use `/dota register` to register your Steam ID.'
                    : `${targetUser.username} is not registered for the Dota leaderboard.`,
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        const [matches, playerData] = await Promise.all([
            opendota.getRecentMatches(record.steam_id, 10),
            opendota.getPlayer(record.steam_id),
        ]);

        if (matches.length === 0) {
            await interaction.editReply({ content: 'No recent matches found.' });
            return;
        }

        const heroNames = await Promise.all(
            matches.map(m => opendota.getHeroName(m.hero_id)),
        );

        const embed = new EmbedBuilder()
            .setTitle(`📜 ${playerData?.profile?.personaname || 'Player'}'s Recent Matches`)
            .setColor(0x00bcd4)
            .setThumbnail(playerData?.profile?.avatarfull || '');

        let matchText = '';
        matches.forEach((match, i) => {
            const isRadiant = match.player_slot < 128;
            const won = isRadiant === match.radiant_win;
            const result = won ? '✅' : '❌';
            const kda = `${match.kills}/${match.deaths}/${match.assists}`;
            const duration = Math.floor(match.duration / 60);
            matchText += `${result} **${heroNames[i]}** - ${kda} (${duration}m)\n`;
        });

        embed.addFields([{ name: '🎮 Last 10 Games', value: matchText, inline: false }]);

        // Calculate recent stats
        const wins = matches.filter(m => (m.player_slot < 128) === m.radiant_win).length;
        const avgKills = (matches.reduce((a, m) => a + m.kills, 0) / matches.length).toFixed(1);
        const avgDeaths = (matches.reduce((a, m) => a + m.deaths, 0) / matches.length).toFixed(1);
        const avgAssists = (matches.reduce((a, m) => a + m.assists, 0) / matches.length).toFixed(1);

        const losses = matches.length - wins;
        embed.addFields([{
            name: '📈 Recent Stats',
            value: `**Record:** ${wins}W/${losses}L | **Avg KDA:** ${avgKills}/${avgDeaths}/${avgAssists}`,
            inline: false,
        }]);

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, discordId, category: 'dota' }, 'Error fetching recent matches');
        const reply = { content: 'An error occurred while fetching recent matches.', ephemeral: true };
        interaction.deferred ? await interaction.editReply(reply) : await interaction.reply(reply);
    }
}

async function handleTotals(interaction: any, { tables, log }: any) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const discordId = targetUser.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    try {
        const record = await tables.DotaUsers.findOne({
            where: { discord_id: discordId, guild_id: guildId },
        });

        if (!record) {
            const isOwn = targetUser.id === interaction.user.id;
            await interaction.reply({
                content: isOwn
                    ? 'You are not registered. Use `/dota register` to register your Steam ID.'
                    : `${targetUser.username} is not registered for the Dota leaderboard.`,
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        const [totals, playerData] = await Promise.all([
            opendota.getTotals(record.steam_id, { significant: 0 }),
            opendota.getPlayer(record.steam_id),
        ]);

        if (totals.length === 0) {
            await interaction.editReply({ content: 'No stats data found.' });
            return;
        }

        const getTotal = (field: string) => totals.find(t => t.field === field);
        const getAvg = (field: string) => {
            const t = getTotal(field);
            return t && t.n > 0 ? (t.sum / t.n).toFixed(1) : 'N/A';
        };

        const kills = getTotal('kills');
        const deaths = getTotal('deaths');
        const assists = getTotal('assists');
        const gamesPlayed = kills?.n || 0;

        const embed = new EmbedBuilder()
            .setTitle(`📊 ${playerData?.profile?.personaname || 'Player'}'s Lifetime Stats`)
            .setColor(0xff9800)
            .setThumbnail(playerData?.profile?.avatarfull || '');

        embed.addFields([
            { name: '🎮 Games Parsed', value: gamesPlayed.toLocaleString(), inline: true },
            { name: '⚔️ Total Kills', value: kills?.sum.toLocaleString() || 'N/A', inline: true },
            { name: '💀 Total Deaths', value: deaths?.sum.toLocaleString() || 'N/A', inline: true },
            { name: '🤝 Total Assists', value: assists?.sum.toLocaleString() || 'N/A', inline: true },
            { name: '📈 Avg Kills', value: getAvg('kills'), inline: true },
            { name: '📉 Avg Deaths', value: getAvg('deaths'), inline: true },
            { name: '💰 Avg GPM', value: getAvg('gold_per_min'), inline: true },
            { name: '✨ Avg XPM', value: getAvg('xp_per_min'), inline: true },
            { name: '🌾 Avg Last Hits', value: getAvg('last_hits'), inline: true },
        ]);

        // Calculate total time played
        const duration = getTotal('duration');
        if (duration) {
            const totalHours = Math.floor(duration.sum / 3600);
            embed.addFields([{
                name: '⏱️ Total Time Played',
                value: `${totalHours.toLocaleString()} hours`,
                inline: true,
            }]);
        }

        embed.setFooter({ text: `Steam ID: ${record.steam_id}` });
        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, discordId, category: 'dota' }, 'Error fetching totals');
        const reply = { content: 'An error occurred while fetching stats.', ephemeral: true };
        interaction.deferred ? await interaction.editReply(reply) : await interaction.reply(reply);
    }
}

async function handlePeers(interaction: any, { tables, log }: any) {
    const targetUser = interaction.options.getUser('user') || interaction.user;
    const discordId = targetUser.id;
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    try {
        const record = await tables.DotaUsers.findOne({
            where: { discord_id: discordId, guild_id: guildId },
        });

        if (!record) {
            const isOwn = targetUser.id === interaction.user.id;
            await interaction.reply({
                content: isOwn
                    ? 'You are not registered. Use `/dota register` to register your Steam ID.'
                    : `${targetUser.username} is not registered for the Dota leaderboard.`,
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        const [peers, playerData] = await Promise.all([
            opendota.getPeers(record.steam_id, { significant: 0 }),
            opendota.getPlayer(record.steam_id),
        ]);

        // Filter to peers with at least 5 games and sort by games
        const topPeers = peers
            .filter(p => p.with_games >= 5 && p.personaname)
            .sort((a, b) => b.with_games - a.with_games)
            .slice(0, 10);

        if (topPeers.length === 0) {
            await interaction.editReply({ content: 'No peer data found (need 5+ games with someone).' });
            return;
        }

        const embed = new EmbedBuilder()
            .setTitle(`👥 ${playerData?.profile?.personaname || 'Player'}'s Top Teammates`)
            .setColor(0x4caf50)
            .setThumbnail(playerData?.profile?.avatarfull || '');

        let peerText = '';
        topPeers.forEach((peer, i) => {
            const winRate = peer.with_games > 0
                ? ((peer.with_win / peer.with_games) * 100).toFixed(1)
                : '0';
            const medal = i < 3 ? ['🥇', '🥈', '🥉'][i] : `${i + 1}.`;
            peerText += `${medal} **${peer.personaname}** - ${peer.with_games} games (${winRate}% WR)\n`;
        });

        embed.addFields([{ name: '🎮 Most Games Together', value: peerText, inline: false }]);
        embed.setFooter({ text: `Steam ID: ${record.steam_id}` });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, discordId, category: 'dota' }, 'Error fetching peers');
        const reply = { content: 'An error occurred while fetching peer data.', ephemeral: true };
        interaction.deferred ? await interaction.editReply(reply) : await interaction.reply(reply);
    }
}

async function handleMatch(interaction: any, { log }: any) {
    const matchId = interaction.options.getString('match_id');

    try {
        await interaction.deferReply();

        const match = await opendota.getMatch(matchId);

        if (!match) {
            await interaction.editReply({ content: `Match ${matchId} not found.` });
            return;
        }

        const heroNames: Record<number, string> = {};
        const uniqueHeroIds = [...new Set(match.players.map(p => p.hero_id))];
        await Promise.all(uniqueHeroIds.map(async id => {
            heroNames[id] = await opendota.getHeroName(id);
        }));

        const duration = Math.floor(match.duration / 60);
        const radiantWin = match.radiant_win;

        const embed = new EmbedBuilder()
            .setTitle(`🎮 Match ${matchId}`)
            .setColor(radiantWin ? 0x4caf50 : 0xf44336)
            .setDescription(`**Duration:** ${duration}m | **Winner:** ${radiantWin ? '🟢 Radiant' : '🔴 Dire'}`);

        // Radiant team
        const radiant = match.players.filter(p => p.player_slot < 128);
        let radiantText = '';
        radiant.forEach(p => {
            const kda = `${p.kills}/${p.deaths}/${p.assists}`;
            const name = p.personaname || 'Anonymous';
            radiantText += `**${heroNames[p.hero_id]}** (${name}) - ${kda}\n`;
        });
        embed.addFields([{
            name: `🟢 Radiant ${radiantWin ? '(Winner)' : ''}`,
            value: radiantText || 'No data',
            inline: true,
        }]);

        // Dire team
        const dire = match.players.filter(p => p.player_slot >= 128);
        let direText = '';
        dire.forEach(p => {
            const kda = `${p.kills}/${p.deaths}/${p.assists}`;
            const name = p.personaname || 'Anonymous';
            direText += `**${heroNames[p.hero_id]}** (${name}) - ${kda}\n`;
        });
        embed.addFields([{
            name: `🔴 Dire ${!radiantWin ? '(Winner)' : ''}`,
            value: direText || 'No data',
            inline: true,
        }]);

        embed.setFooter({ text: `Score: ${match.radiant_score || 0} - ${match.dire_score || 0}` });

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, matchId, category: 'dota' }, 'Error fetching match');
        const reply = { content: 'An error occurred while fetching match data.', ephemeral: true };
        interaction.deferred ? await interaction.editReply(reply) : await interaction.reply(reply);
    }
}

async function handleRandom(interaction: any, { tables, log }: any) {
    try {
        // Get filter options
        const attributeFilter = interaction.options.getString('attribute');
        const attackFilter = interaction.options.getString('attack');
        const roleFilter = interaction.options.getString('role');
        const positionFilter = interaction.options.getString('position');

        // Track applied filters for display
        const appliedFilters: string[] = [];

        // Build WHERE clause for database query
        const whereClause: any = {};

        if (attributeFilter) {
            whereClause.primary_attr = attributeFilter;
            appliedFilters.push(`Attribute: ${ATTR_LABELS[attributeFilter] || attributeFilter}`);
        }

        if (attackFilter) {
            whereClause.attack_type = attackFilter;
            appliedFilters.push(`Attack: ${attackFilter}`);
        }

        // Query heroes from database
        let heroes = await tables.DotaHeroes.findAll({ where: whereClause });

        // If no heroes in database, fall back to API
        if (heroes.length === 0 && Object.keys(whereClause).length === 0) {
            log.warn({ category: 'dota' }, 'No heroes in database, falling back to API');
            const apiHeroes = await opendota.getHeroConstants();
            const heroList = Object.values(apiHeroes).filter(h => h.localized_name);

            if (heroList.length === 0) {
                await interaction.reply({
                    content: 'No heroes found. Please run `/dota sync` first to populate the hero database.',
                    ephemeral: true,
                });
                return;
            }

            const randomHero = heroList[Math.floor(Math.random() * heroList.length)];
            const embed = new EmbedBuilder()
                .setTitle('🎲 Random Hero')
                .setColor(0x9c27b0)
                .setDescription(`Your hero is: **${randomHero.localized_name}**`)
                .addFields([
                    {
                        name: '⚔️ Attribute',
                        value: ATTR_LABELS[randomHero.primary_attr] || randomHero.primary_attr.toUpperCase(),
                        inline: true,
                    },
                    { name: '🗡️ Attack', value: randomHero.attack_type, inline: true },
                    { name: '🎭 Roles', value: randomHero.roles.join(', ') || 'N/A', inline: false },
                ])
                .setThumbnail(`https://cdn.cloudflare.steamstatic.com${randomHero.img}`)
                .setFooter({ text: '⚠️ Run /dota sync to enable filtering' });

            await interaction.reply({ embeds: [embed] });
            return;
        }

        // Apply role filter (JSON array field - filter in JS)
        if (roleFilter) {
            heroes = heroes.filter((h: any) => {
                const roles = h.roles || [];
                return roles.includes(roleFilter);
            });
            appliedFilters.push(`Role: ${roleFilter}`);
        }

        // Apply position filter (JSON array field - filter in JS)
        if (positionFilter) {
            heroes = heroes.filter((h: any) => {
                const positions = h.positions || [];
                return positions.includes(positionFilter);
            });
            appliedFilters.push(`Position: ${POSITION_LABELS[positionFilter as Position] || positionFilter}`);
        }

        // Handle empty result
        if (heroes.length === 0) {
            const filterText = appliedFilters.length > 0
                ? `\n**Filters:** ${appliedFilters.join(' | ')}`
                : '';
            await interaction.reply({
                content: `No heroes match your filters.${filterText}\n\n` +
                    `Try removing some filters or using different combinations.`,
                ephemeral: true,
            });
            return;
        }

        // Pick random hero from filtered list
        const randomHero = heroes[Math.floor(Math.random() * heroes.length)];
        const heroRoles = randomHero.roles || [];
        const heroPositions = (randomHero.positions || []) as Position[];

        const embed = new EmbedBuilder()
            .setTitle('🎲 Random Hero')
            .setColor(0x9c27b0)
            .setDescription(`Your hero is: **${randomHero.localized_name}**`)
            .addFields([
                {
                    name: '⚔️ Attribute',
                    value: ATTR_LABELS[randomHero.primary_attr] || randomHero.primary_attr.toUpperCase(),
                    inline: true,
                },
                { name: '🗡️ Attack', value: randomHero.attack_type, inline: true },
                { name: '🎭 Roles', value: heroRoles.join(', ') || 'N/A', inline: false },
            ]);

        // Add positions if set
        if (heroPositions.length > 0) {
            embed.addFields([{
                name: '📍 Positions',
                value: heroPositions.map((p: Position) => POSITION_LABELS[p] || p).join(', '),
                inline: false,
            }]);
        }

        // Add filters applied section if any
        if (appliedFilters.length > 0) {
            embed.addFields([{
                name: '🔍 Filters Applied',
                value: appliedFilters.join(' | '),
                inline: false,
            }]);
        }

        // Set thumbnail and footer
        if (randomHero.img) {
            embed.setThumbnail(`https://cdn.cloudflare.steamstatic.com${randomHero.img}`);
        }
        embed.setFooter({ text: `Selected from ${heroes.length} hero${heroes.length !== 1 ? 'es' : ''}` });

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, category: 'dota' }, 'Error getting random hero');
        await interaction.reply({ content: 'An error occurred while picking a random hero.', ephemeral: true });
    }
}

async function handleHelp(interaction: any) {
    const embed = new EmbedBuilder()
        .setTitle(HELP_TEXT.title)
        .setColor(0x1a1a2e)
        .setDescription(HELP_TEXT.description)
        .addFields([
            {
                name: 'Setup Instructions',
                value: HELP_TEXT.setup,
                inline: false,
            },
            {
                name: 'Available Commands',
                value: HELP_TEXT.commands,
                inline: false,
            },
        ])
        .setFooter({ text: 'Data provided by OpenDota API' });

    await interaction.reply({ embeds: [embed] });
}

async function handleSteamId(interaction: any, { tables, log }: any) {
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
            const isOwn = targetUser.id === interaction.user.id;
            await interaction.reply({
                content: isOwn
                    ? 'You are not registered. Use `/dota register` to register your Steam ID.'
                    : `${targetUser.username} is not registered for the Dota leaderboard.`,
                ephemeral: true,
            });
            return;
        }

        const steamId32 = record.steam_id;
        const steamId64 = BigInt(steamId32) + BigInt('76561197960265728');
        const steamProfileUrl = `https://steamcommunity.com/profiles/${steamId64}`;
        const opendotaUrl = `https://www.opendota.com/players/${steamId32}`;
        const dotabuffUrl = `https://www.dotabuff.com/players/${steamId32}`;

        const embed = new EmbedBuilder()
            .setTitle(`Steam ID for ${record.steam_username || targetUser.username}`)
            .setColor(0x1a1a2e)
            .addFields([
                {
                    name: 'Steam ID (32-bit)',
                    value: `\`${steamId32}\``,
                    inline: true,
                },
                {
                    name: 'Steam ID (64-bit)',
                    value: `\`${steamId64}\``,
                    inline: true,
                },
                {
                    name: 'Links',
                    value: [
                        `[Steam Profile](${steamProfileUrl})`,
                        `[OpenDota](${opendotaUrl})`,
                        `[Dotabuff](${dotabuffUrl})`,
                    ].join(' • '),
                    inline: false,
                },
            ])
            .setFooter({ text: `Requested by ${interaction.user.username}` });

        await interaction.reply({ embeds: [embed] });

        log.info({ discordId, steamId: steamId32, category: 'dota' }, 'Steam ID lookup');
    } catch (error) {
        log.error({ err: error, discordId, category: 'dota' }, 'Error fetching Steam ID');
        await interaction.reply({
            content: 'An error occurred while looking up the Steam ID.',
            ephemeral: true,
        });
    }
}

async function handleSync(interaction: any, { tables, log }: any) {
    try {
        // Check owner permission
        await checkOwnerPermission(interaction);

        await interaction.deferReply({ ephemeral: true });

        // Fetch heroes from OpenDota API
        const heroes = await opendota.getHeroConstants();
        const heroList = Object.values(heroes).filter(h => h.localized_name);

        if (heroList.length === 0) {
            await interaction.editReply({ content: 'Could not fetch hero list from OpenDota API.' });
            return;
        }

        let created = 0;
        let updated = 0;

        // Upsert each hero (preserve existing position data)
        for (const hero of heroList) {
            // Build the hero data object with all stats
            const heroData = {
                hero_id: hero.id,
                name: hero.name,
                localized_name: hero.localized_name,
                primary_attr: hero.primary_attr,
                attack_type: hero.attack_type,
                roles: hero.roles || [],
                img: hero.img,
                icon: hero.icon,
                // Base stats
                base_health: hero.base_health,
                base_health_regen: hero.base_health_regen,
                base_mana: hero.base_mana,
                base_mana_regen: hero.base_mana_regen,
                base_armor: hero.base_armor,
                base_mr: hero.base_mr,
                // Attributes
                base_str: hero.base_str,
                base_agi: hero.base_agi,
                base_int: hero.base_int,
                str_gain: hero.str_gain,
                agi_gain: hero.agi_gain,
                int_gain: hero.int_gain,
                // Attack
                base_attack_min: hero.base_attack_min,
                base_attack_max: hero.base_attack_max,
                attack_range: hero.attack_range,
                projectile_speed: hero.projectile_speed,
                attack_rate: hero.attack_rate,
                attack_point: hero.attack_point,
                // Movement/Vision
                move_speed: hero.move_speed,
                turn_rate: hero.turn_rate,
                day_vision: hero.day_vision,
                night_vision: hero.night_vision,
                // Other
                legs: hero.legs,
            };

            const [record, wasCreated] = await tables.DotaHeroes.findOrCreate({
                where: { hero_id: hero.id },
                defaults: {
                    ...heroData,
                    positions: [],
                },
            });

            if (wasCreated) {
                created++;
            } else {
                // Update existing record but preserve positions
                await record.update(heroData);
                updated++;
            }
        }

        log.info({ created, updated, total: heroList.length, category: 'dota' }, 'Hero database synced');

        await interaction.editReply({
            content: `✅ Hero database synced successfully!\n` +
                `**Created:** ${created} heroes\n` +
                `**Updated:** ${updated} heroes\n` +
                `**Total:** ${heroList.length} heroes`,
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized: User is not bot owner') {
            return; // Already replied in checkOwnerPermission
        }
        log.error({ err: error, category: 'dota' }, 'Error syncing hero database');
        const reply = { content: 'An error occurred while syncing the hero database.', ephemeral: true };
        if (interaction.deferred) {
            await interaction.editReply(reply);
        } else {
            await interaction.reply(reply);
        }
    }
}

async function handleSetPosition(interaction: any, { tables, log }: any) {
    try {
        // Check owner permission
        await checkOwnerPermission(interaction);

        const heroName = interaction.options.getString('hero');
        const positionsInput = interaction.options.getString('positions');

        // Parse and validate positions
        const positions = positionsInput
            .split(',')
            .map((p: string) => p.trim().toLowerCase())
            .filter((p: string) => p.length > 0);

        const invalidPositions = positions.filter((p: string) => !VALID_POSITIONS.includes(p as Position));
        if (invalidPositions.length > 0) {
            await interaction.reply({
                content: `❌ Invalid positions: ${invalidPositions.join(', ')}\n` +
                    `Valid positions are: ${VALID_POSITIONS.join(', ')}`,
                ephemeral: true,
            });
            return;
        }

        // Find the hero in database
        const hero = await tables.DotaHeroes.findOne({
            where: {
                localized_name: { [Op.like]: heroName },
            },
        });

        if (!hero) {
            await interaction.reply({
                content: `❌ Hero "${heroName}" not found in database.\n` +
                    `Make sure to run \`/dota sync\` first to populate the hero database.`,
                ephemeral: true,
            });
            return;
        }

        // Update hero positions
        await hero.update({ positions });

        log.info({
            heroId: hero.hero_id,
            heroName: hero.localized_name,
            positions,
            category: 'dota',
        }, 'Hero positions updated');

        const positionDisplay = positions.length > 0
            ? positions.map((p: Position) => POSITION_LABELS[p] || p).join(', ')
            : 'None';

        await interaction.reply({
            content: `✅ Updated **${hero.localized_name}** positions to: ${positionDisplay}`,
            ephemeral: true,
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized: User is not bot owner') {
            return; // Already replied in checkOwnerPermission
        }
        log.error({ err: error, category: 'dota' }, 'Error setting hero position');
        await interaction.reply({
            content: 'An error occurred while setting hero position.',
            ephemeral: true,
        });
    }
}

async function handleSyncPositions(interaction: any, { tables, log }: any) {
    try {
        // Check owner permission
        await checkOwnerPermission(interaction);

        await interaction.deferReply({ ephemeral: true });

        // Get all heroes from database
        const heroes = await tables.DotaHeroes.findAll();

        if (heroes.length === 0) {
            await interaction.editReply({
                content: '❌ No heroes in database. Run `/dota sync` first to populate heroes.',
            });
            return;
        }

        let updated = 0;
        let skipped = 0;

        // Update each hero with positions from mapping
        for (const hero of heroes) {
            const positions = HERO_POSITIONS[hero.localized_name];

            if (positions && positions.length > 0) {
                // Only update if positions changed
                const currentPositions = hero.positions || [];
                if (JSON.stringify(currentPositions.sort()) !== JSON.stringify(positions.sort())) {
                    await hero.update({ positions });
                    updated++;
                } else {
                    skipped++;
                }
            } else {
                skipped++;
            }
        }

        log.info({ updated, skipped, total: heroes.length, category: 'dota' }, 'Hero positions synced');

        // Count heroes with positions
        const heroesWithPositions = await tables.DotaHeroes.count({
            where: {
                positions: { [Op.ne]: '[]' },
            },
        });

        await interaction.editReply({
            content: `✅ Hero positions synced!\n` +
                `**Updated:** ${updated} heroes\n` +
                `**Unchanged:** ${skipped} heroes\n` +
                `**Total with positions:** ${heroesWithPositions} heroes`,
        });
    } catch (error: any) {
        if (error.message === 'Unauthorized: User is not bot owner') {
            return; // Already replied in checkOwnerPermission
        }
        log.error({ err: error, category: 'dota' }, 'Error syncing hero positions');
        const reply = { content: 'An error occurred while syncing hero positions.', ephemeral: true };
        if (interaction.deferred) {
            await interaction.editReply(reply);
        } else {
            await interaction.reply(reply);
        }
    }
}

async function handleSearch(interaction: any, { tables, log }: any) {
    try {
        const heroName = interaction.options.getString('hero');
        const filter = interaction.options.getString('filter');

        // Build query
        const whereClause: any = {};

        if (heroName) {
            whereClause.localized_name = { [Op.like]: `%${heroName}%` };
        }

        const heroes = await tables.DotaHeroes.findAll({
            where: whereClause,
            order: [['localized_name', 'ASC']],
            limit: 25,
        });

        if (heroes.length === 0) {
            await interaction.reply({
                content: heroName
                    ? `No heroes found matching "${heroName}". Run \`/dota sync\` if heroes aren't loaded.`
                    : 'No heroes in database. Run `/dota sync` first.',
                ephemeral: true,
            });
            return;
        }

        // Apply post-query filter for positions
        let filteredHeroes = heroes;
        if (filter === 'no_positions') {
            filteredHeroes = heroes.filter((h: any) => {
                const positions = h.positions || [];
                return positions.length === 0;
            });
        } else if (filter === 'has_positions') {
            filteredHeroes = heroes.filter((h: any) => {
                const positions = h.positions || [];
                return positions.length > 0;
            });
        }

        if (filteredHeroes.length === 0) {
            const filterMsg = filter === 'no_positions'
                ? 'All matched heroes have positions set.'
                : 'No matched heroes have positions set.';
            await interaction.reply({ content: filterMsg, ephemeral: true });
            return;
        }

        // If searching for a specific hero, show detailed view
        if (heroName && filteredHeroes.length === 1) {
            const hero = filteredHeroes[0];
            const heroRoles = hero.roles || [];
            const heroPositions = (hero.positions || []) as Position[];

            const embed = new EmbedBuilder()
                .setTitle(`🦸 ${hero.localized_name}`)
                .setColor(0x7c4dff)
                .addFields([
                    {
                        name: '⚔️ Attribute',
                        value: ATTR_LABELS[hero.primary_attr] || hero.primary_attr.toUpperCase(),
                        inline: true,
                    },
                    { name: '🗡️ Attack', value: hero.attack_type, inline: true },
                    {
                        name: '🦵 Legs',
                        value: hero.legs?.toString() || 'N/A',
                        inline: true,
                    },
                ]);

            // Add base stats if available
            if (hero.base_str !== null) {
                const attrStr = `STR: ${hero.base_str} (+${hero.str_gain})`;
                const attrAgi = `AGI: ${hero.base_agi} (+${hero.agi_gain})`;
                const attrInt = `INT: ${hero.base_int} (+${hero.int_gain})`;
                embed.addFields([{
                    name: '📊 Attributes',
                    value: `${attrStr}\n${attrAgi}\n${attrInt}`,
                    inline: true,
                }]);
            }

            // Add combat stats
            if (hero.base_attack_min !== null) {
                const dmg = `${hero.base_attack_min}-${hero.base_attack_max}`;
                const atkInfo = [
                    `Damage: ${dmg}`,
                    `Range: ${hero.attack_range}`,
                    `BAT: ${hero.attack_rate}`,
                ];
                embed.addFields([{
                    name: '⚔️ Attack',
                    value: atkInfo.join('\n'),
                    inline: true,
                }]);
            }

            // Add defense stats
            if (hero.base_armor !== null) {
                const defInfo = [
                    `Armor: ${hero.base_armor}`,
                    `Magic Res: ${hero.base_mr}%`,
                ];
                embed.addFields([{
                    name: '🛡️ Defense',
                    value: defInfo.join('\n'),
                    inline: true,
                }]);
            }

            // Add movement/vision
            if (hero.move_speed !== null) {
                const moveInfo = [
                    `Speed: ${hero.move_speed}`,
                    `Vision: ${hero.day_vision}/${hero.night_vision}`,
                ];
                embed.addFields([{
                    name: '👁️ Movement',
                    value: moveInfo.join('\n'),
                    inline: true,
                }]);
            }

            // Add roles and positions
            embed.addFields([
                { name: '🎭 Roles', value: heroRoles.join(', ') || 'None', inline: false },
                {
                    name: '📍 Positions',
                    value: heroPositions.length > 0
                        ? heroPositions.map((p: Position) => POSITION_LABELS[p] || p).join(', ')
                        : '❌ Not set',
                    inline: false,
                },
            ]);

            if (hero.img) {
                embed.setThumbnail(`https://cdn.cloudflare.steamstatic.com${hero.img}`);
            }

            await interaction.reply({ embeds: [embed] });
            return;
        }

        // List view for multiple heroes
        const embed = new EmbedBuilder()
            .setTitle('🔍 Hero Search Results')
            .setColor(0x7c4dff);

        if (filter) {
            const filterLabel = filter === 'no_positions' ? 'Without Positions' : 'With Positions';
            embed.setDescription(`**Filter:** ${filterLabel}`);
        }

        // Group heroes into chunks for display
        let heroList = '';
        for (const hero of filteredHeroes) {
            const positions = hero.positions || [];
            const posStr = positions.length > 0
                ? positions.join(', ')
                : '❌';
            heroList += `**${hero.localized_name}** - ${posStr}\n`;
        }

        const countSuffix = heroes.length > filteredHeroes.length
            ? ` of ${heroes.length}`
            : '';
        embed.addFields([{
            name: `Heroes (${filteredHeroes.length}${countSuffix})`,
            value: heroList || 'No heroes found',
            inline: false,
        }]);

        if (heroes.length >= 25) {
            embed.setFooter({ text: 'Results limited to 25. Use a more specific search.' });
        }

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, category: 'dota' }, 'Error searching heroes');
        await interaction.reply({
            content: 'An error occurred while searching heroes.',
            ephemeral: true,
        });
    }
}

async function handleCompare(interaction: any, { tables, log }: any) {
    const user1 = interaction.options.getUser('user1');
    const user2 = interaction.options.getUser('user2');
    const guildId = interaction.guild?.id;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    try {
        const [record1, record2] = await Promise.all([
            tables.DotaUsers.findOne({ where: { discord_id: user1.id, guild_id: guildId } }),
            tables.DotaUsers.findOne({ where: { discord_id: user2.id, guild_id: guildId } }),
        ]);

        if (!record1 || !record2) {
            const missing = !record1 ? user1.username : user2.username;
            await interaction.reply({
                content: `${missing} is not registered for the Dota leaderboard.`,
                ephemeral: true,
            });
            return;
        }

        await interaction.deferReply();

        const [player1, player2, wl1, wl2, totals1, totals2] = await Promise.all([
            opendota.getPlayer(record1.steam_id),
            opendota.getPlayer(record2.steam_id),
            opendota.getWinLoss(record1.steam_id, { significant: 0 }),
            opendota.getWinLoss(record2.steam_id, { significant: 0 }),
            opendota.getTotals(record1.steam_id, { significant: 0 }),
            opendota.getTotals(record2.steam_id, { significant: 0 }),
        ]);

        const getAvg = (totals: any[], field: string) => {
            const t = totals.find(x => x.field === field);
            return t && t.n > 0 ? (t.sum / t.n).toFixed(1) : 'N/A';
        };

        const wr1 = wl1 ? ((wl1.win / (wl1.win + wl1.lose)) * 100).toFixed(1) : 'N/A';
        const wr2 = wl2 ? ((wl2.win / (wl2.win + wl2.lose)) * 100).toFixed(1) : 'N/A';

        const name1 = player1?.profile?.personaname || user1.username;
        const name2 = player2?.profile?.personaname || user2.username;

        const embed = new EmbedBuilder()
            .setTitle(`⚔️ ${name1} vs ${name2}`)
            .setColor(0xe91e63);

        const makeComparison = (label: string, v1: string, v2: string) =>
            `**${label}**\n${v1} vs ${v2}`;

        embed.addFields([
            {
                name: '📊 Win Rate',
                value: makeComparison('', `${wr1}%`, `${wr2}%`),
                inline: true,
            },
            {
                name: '🎮 Total Games',
                value: makeComparison('', `${wl1 ? wl1.win + wl1.lose : 0}`, `${wl2 ? wl2.win + wl2.lose : 0}`),
                inline: true,
            },
            {
                name: '⚔️ Avg Kills',
                value: makeComparison('', getAvg(totals1, 'kills'), getAvg(totals2, 'kills')),
                inline: true,
            },
            {
                name: '💀 Avg Deaths',
                value: makeComparison('', getAvg(totals1, 'deaths'), getAvg(totals2, 'deaths')),
                inline: true,
            },
            {
                name: '💰 Avg GPM',
                value: makeComparison('', getAvg(totals1, 'gold_per_min'), getAvg(totals2, 'gold_per_min')),
                inline: true,
            },
            {
                name: '✨ Avg XPM',
                value: makeComparison('', getAvg(totals1, 'xp_per_min'), getAvg(totals2, 'xp_per_min')),
                inline: true,
            },
        ]);

        await interaction.editReply({ embeds: [embed] });
    } catch (error) {
        log.error({ err: error, category: 'dota' }, 'Error comparing players');
        const reply = { content: 'An error occurred while comparing players.', ephemeral: true };
        interaction.deferred ? await interaction.editReply(reply) : await interaction.reply(reply);
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
                .setRequired(false))
            .addStringOption((option: any) => option
                .setName('mode')
                .setDescription('Game mode to filter stats')
                .setRequired(false)
                .addChoices(
                    { name: 'All Modes (incl. Turbo)', value: 'all' },
                    { name: 'Ranked Only', value: 'ranked' },
                )))
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
                ))
            .addStringOption((option: any) => option
                .setName('mode')
                .setDescription('Game mode to filter stats')
                .setRequired(false)
                .addChoices(
                    { name: 'All Modes (incl. Turbo)', value: 'all' },
                    { name: 'Ranked Only', value: 'ranked' },
                )))
        .addSubcommand((subcommand: any) => subcommand
            .setName('heroes')
            .setDescription('View top played heroes')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('User to view (defaults to yourself)')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('recent')
            .setDescription('View recent matches')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('User to view (defaults to yourself)')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('totals')
            .setDescription('View lifetime stats')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('User to view (defaults to yourself)')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('peers')
            .setDescription('View top teammates')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('User to view (defaults to yourself)')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('match')
            .setDescription('View match details')
            .addStringOption((option: any) => option
                .setName('match_id')
                .setDescription('Match ID to look up')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('random')
            .setDescription('Get a random hero to play')
            .addStringOption((option: any) => option
                .setName('attribute')
                .setDescription('Filter by primary attribute')
                .setRequired(false)
                .addChoices(
                    { name: 'Strength', value: 'str' },
                    { name: 'Agility', value: 'agi' },
                    { name: 'Intelligence', value: 'int' },
                    { name: 'Universal', value: 'all' },
                ))
            .addStringOption((option: any) => option
                .setName('attack')
                .setDescription('Filter by attack type')
                .setRequired(false)
                .addChoices(
                    { name: 'Melee', value: 'Melee' },
                    { name: 'Ranged', value: 'Ranged' },
                ))
            .addStringOption((option: any) => option
                .setName('role')
                .setDescription('Filter by hero role')
                .setRequired(false)
                .addChoices(
                    { name: 'Carry', value: 'Carry' },
                    { name: 'Support', value: 'Support' },
                    { name: 'Nuker', value: 'Nuker' },
                    { name: 'Disabler', value: 'Disabler' },
                    { name: 'Durable', value: 'Durable' },
                    { name: 'Escape', value: 'Escape' },
                    { name: 'Pusher', value: 'Pusher' },
                    { name: 'Initiator', value: 'Initiator' },
                ))
            .addStringOption((option: any) => option
                .setName('position')
                .setDescription('Filter by lane position')
                .setRequired(false)
                .addChoices(
                    { name: 'Position 1 (Safelane Carry)', value: 'pos1' },
                    { name: 'Position 2 (Mid)', value: 'pos2' },
                    { name: 'Position 3 (Offlane)', value: 'pos3' },
                    { name: 'Position 4 (Soft Support)', value: 'pos4' },
                    { name: 'Position 5 (Hard Support)', value: 'pos5' },
                )))
        .addSubcommand((subcommand: any) => subcommand
            .setName('compare')
            .setDescription('Compare two players')
            .addUserOption((option: any) => option
                .setName('user1')
                .setDescription('First player')
                .setRequired(true))
            .addUserOption((option: any) => option
                .setName('user2')
                .setDescription('Second player')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('help')
            .setDescription('Show setup guide and available commands'))
        .addSubcommand((subcommand: any) => subcommand
            .setName('steamid')
            .setDescription('Look up a user\'s Steam ID')
            .addUserOption((option: any) => option
                .setName('user')
                .setDescription('User to look up (defaults to yourself)')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('sync')
            .setDescription('Sync hero database from OpenDota API (owner only)'))
        .addSubcommand((subcommand: any) => subcommand
            .setName('setposition')
            .setDescription('Set a hero\'s lane positions (owner only)')
            .addStringOption((option: any) => option
                .setName('hero')
                .setDescription('Hero name')
                .setRequired(true)
                .setAutocomplete(true))
            .addStringOption((option: any) => option
                .setName('positions')
                .setDescription('Comma-separated positions (e.g., pos1,pos2)')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('syncpositions')
            .setDescription('Sync hero positions from built-in mapping (owner only)'))
        .addSubcommand((subcommand: any) => subcommand
            .setName('search')
            .setDescription('Search heroes and view their positions')
            .addStringOption((option: any) => option
                .setName('hero')
                .setDescription('Hero name to search for')
                .setRequired(false)
                .setAutocomplete(true))
            .addStringOption((option: any) => option
                .setName('filter')
                .setDescription('Filter results')
                .setRequired(false)
                .addChoices(
                    { name: 'Without Positions', value: 'no_positions' },
                    { name: 'With Positions', value: 'has_positions' },
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
            case 'heroes':
                await handleHeroes(interaction, context);
                break;
            case 'recent':
                await handleRecent(interaction, context);
                break;
            case 'totals':
                await handleTotals(interaction, context);
                break;
            case 'peers':
                await handlePeers(interaction, context);
                break;
            case 'match':
                await handleMatch(interaction, context);
                break;
            case 'random':
                await handleRandom(interaction, context);
                break;
            case 'compare':
                await handleCompare(interaction, context);
                break;
            case 'help':
                await handleHelp(interaction);
                break;
            case 'steamid':
                await handleSteamId(interaction, context);
                break;
            case 'sync':
                await handleSync(interaction, context);
                break;
            case 'setposition':
                await handleSetPosition(interaction, context);
                break;
            case 'syncpositions':
                await handleSyncPositions(interaction, context);
                break;
            case 'search':
                await handleSearch(interaction, context);
                break;
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    ephemeral: true,
                });
                break;
        }
    },

    async autocomplete(interaction: any, context: any) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'hero') {
            const searchValue = focusedOption.value.toLowerCase();
            const { tables } = context;

            try {
                // Get all heroes from database
                const heroes = await tables.DotaHeroes.findAll({
                    attributes: ['localized_name'],
                    order: [['localized_name', 'ASC']],
                });

                // Filter by search value and limit to 25 results
                const filtered = heroes
                    .map((h: any) => h.localized_name)
                    .filter((name: string) => name.toLowerCase().includes(searchValue))
                    .slice(0, 25);

                await interaction.respond(
                    filtered.map((name: string) => ({
                        name: name,
                        value: name,
                    })),
                );
            } catch {
                // If database query fails, return empty list
                await interaction.respond([]);
            }
        }
    },
};
