import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import opendota, { ModePreset } from "../lib/apis/opendota";

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

async function handleRandom(interaction: any, { log }: any) {
    try {
        const heroes = await opendota.getHeroConstants();
        const heroList = Object.values(heroes).filter(h => h.localized_name);

        if (heroList.length === 0) {
            await interaction.reply({ content: 'Could not fetch hero list.', ephemeral: true });
            return;
        }

        const randomHero = heroList[Math.floor(Math.random() * heroList.length)];

        const embed = new EmbedBuilder()
            .setTitle('🎲 Random Hero')
            .setColor(0x9c27b0)
            .setDescription(`Your hero is: **${randomHero.localized_name}**`)
            .addFields([
                { name: '⚔️ Attribute', value: randomHero.primary_attr.toUpperCase(), inline: true },
                { name: '🗡️ Attack', value: randomHero.attack_type, inline: true },
                { name: '🎭 Roles', value: randomHero.roles.join(', ') || 'N/A', inline: false },
            ])
            .setThumbnail(`https://cdn.cloudflare.steamstatic.com${randomHero.img}`);

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
            .setDescription('Get a random hero to play'))
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
                .setRequired(false))),

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
            default:
                await interaction.reply({
                    content: 'Unknown subcommand.',
                    ephemeral: true,
                });
                break;
        }
    },
};
