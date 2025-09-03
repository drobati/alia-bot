import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ChartJSNodeCanvas } from 'chartjs-node-canvas';
import { Op } from 'sequelize';
import { Context } from '../utils/types';

const CHART_WIDTH = 800;
const CHART_HEIGHT = 400;

export default {
    data: new SlashCommandBuilder()
        .setName('stats')
        .setDescription('Display server and bot statistics')
        .addStringOption(option =>
            option
                .setName('type')
                .setDescription('Type of statistics to display')
                .setRequired(false)
                .addChoices(
                    { name: 'Server Overview', value: 'server' },
                    { name: 'Bot Usage', value: 'bot' },
                    { name: 'Member Activity', value: 'activity' },
                    { name: 'All Statistics', value: 'all' },
                ))
        .addBooleanOption(option =>
            option
                .setName('public')
                .setDescription('Share stats with the channel (default: private)')
                .setRequired(false)),

    async execute(interaction: any, context: Context) {
        const { log } = context;
        const statsType = interaction.options.getString('type') || 'server';
        const isPublic = interaction.options.getBoolean('public') || false;

        try {
            await interaction.deferReply({ ephemeral: !isPublic });

            const guild = interaction.guild;
            if (!guild) {
                await interaction.editReply({
                    content: '❌ This command can only be used in a server.',
                });
                return;
            }

            const embed = new EmbedBuilder()
                .setTitle(`📊 ${guild.name} Statistics`)
                .setColor(0x3498DB)
                .setThumbnail(guild.iconURL({ dynamic: true }) || null)
                .setTimestamp();

            let attachments: AttachmentBuilder[] = [];

            switch (statsType) {
                case 'server':
                    await addServerStats(embed, guild);
                    break;
                case 'bot':
                    attachments = await addBotUsageStats(embed, guild, context);
                    break;
                case 'activity':
                    attachments = await addActivityStats(embed, guild, context);
                    break;
                case 'all': {
                    await addServerStats(embed, guild);
                    const botAttachments = await addBotUsageStats(embed, guild, context);
                    const activityAttachments = await addActivityStats(embed, guild, context);
                    attachments = [...botAttachments, ...activityAttachments];
                    break;
                }
            }

            await interaction.editReply({
                embeds: [embed],
                files: attachments,
            });

            log.info('Stats command executed', {
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: guild.id,
                statsType: statsType,
                isPublic: isPublic,
            });

        } catch (error) {
            log.error('Stats command failed', {
                userId: interaction.user.id,
                error: error,
            });

            const errorMessage = '❌ Failed to generate statistics. Please try again later.';

            if (interaction.deferred) {
                await interaction.editReply({ content: errorMessage });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

async function addServerStats(embed: EmbedBuilder, guild: any): Promise<void> {
    // Server member statistics
    const totalMembers = guild.memberCount;
    const onlineMembers = guild.members.cache.filter((member: any) =>
        member.presence?.status === 'online' || member.presence?.status === 'idle' || member.presence?.status === 'dnd',
    ).size;

    const botCount = guild.members.cache.filter((member: any) => member.user.bot).size;
    const humanCount = totalMembers - botCount;

    // Server info
    const createdAt = guild.createdAt;
    const boostLevel = guild.premiumTier;
    const boostCount = guild.premiumSubscriptionCount;
    const channelCount = guild.channels.cache.size;
    const roleCount = guild.roles.cache.size;

    // Calculate server age
    const serverAge = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));

    embed.addFields([
        {
            name: '👥 Members',
            value: [
                `**Total:** ${totalMembers.toLocaleString()}`,
                `**Online:** ${onlineMembers.toLocaleString()}`,
                `**Humans:** ${humanCount.toLocaleString()}`,
                `**Bots:** ${botCount.toLocaleString()}`,
            ].join('\n'),
            inline: true,
        },
        {
            name: '🏠 Server Info',
            value: [
                `**Created:** ${serverAge} days ago`,
                `**Boost Level:** ${boostLevel}`,
                `**Boosts:** ${boostCount}`,
                `**Channels:** ${channelCount.toLocaleString()}`,
                `**Roles:** ${roleCount.toLocaleString()}`,
            ].join('\n'),
            inline: true,
        },
    ]);
}

async function addBotUsageStats(embed: EmbedBuilder, guild: any, context: Context): Promise<AttachmentBuilder[]> {
    try {
        // Get command usage from memories or config table
        const commandStats = await context.tables.Config.findAll({
            where: {
                key: { [Op.like]: 'command_usage_%' },
            },
        });

        // Process command statistics
        const commandCounts: { [key: string]: number } = {};
        let totalCommands = 0;

        commandStats.forEach((stat: any) => {
            const command = stat.key.replace('command_usage_', '');
            const count = parseInt(stat.value) || 0;
            commandCounts[command] = count;
            totalCommands += count;
        });

        // Get top 8 commands for chart
        const topCommands = Object.entries(commandCounts)
            .sort(([, a], [, b]) => b - a)
            .slice(0, 8);

        if (topCommands.length > 0) {
            // Create usage stats field
            const topCommandsText = topCommands
                .slice(0, 5)
                .map(([cmd, count], index) => {
                    const percentage = ((count / totalCommands) * 100).toFixed(1);
                    return `**${index + 1}.** /${cmd}: ${count} (${percentage}%)`;
                })
                .join('\n');

            embed.addFields([
                {
                    name: '🤖 Bot Usage',
                    value: [
                        `**Total Commands:** ${totalCommands.toLocaleString()}`,
                        `**Unique Commands:** ${Object.keys(commandCounts).length}`,
                        '',
                        '**Top Commands:**',
                        topCommandsText,
                    ].join('\n'),
                    inline: false,
                },
            ]);

            // Generate chart
            const chartConfig = {
                type: 'doughnut' as const,
                data: {
                    labels: topCommands.map(([cmd]) => `/${cmd}`),
                    datasets: [{
                        data: topCommands.map(([, count]) => count),
                        backgroundColor: [
                            '#FF6384', '#36A2EB', '#FFCE56', '#4BC0C0',
                            '#9966FF', '#FF9F40', '#FF6384', '#C9CBCF',
                        ],
                        borderWidth: 2,
                        borderColor: '#36393F',
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Command Usage Distribution',
                            color: '#FFFFFF',
                            font: { size: 16 },
                        },
                        legend: {
                            position: 'right' as const,
                            labels: { color: '#FFFFFF' },
                        },
                    },
                    backgroundColor: '#2C2F33',
                },
            };

            const chartCanvas = new ChartJSNodeCanvas({
                width: CHART_WIDTH,
                height: CHART_HEIGHT,
                backgroundColour: '#2C2F33',
            });

            const chartBuffer = await chartCanvas.renderToBuffer(chartConfig);
            const chartAttachment = new AttachmentBuilder(chartBuffer, { name: 'bot-usage-chart.png' });

            return [chartAttachment];
        }
    } catch (error) {
        context.log.error('Error generating bot usage stats:', error);
    }

    return [];
}

async function addActivityStats(embed: EmbedBuilder, guild: any, context: Context): Promise<AttachmentBuilder[]> {
    try {
        // Get recent rollcall activity as a proxy for member engagement
        const recentActivity = await context.tables.RollCall.findAll({
            where: {
                guildId: guild.id,
                updatedAt: {
                    [Op.gte]: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // Last 7 days
                },
            },
            order: [['updatedAt', 'DESC']],
        });

        if (recentActivity.length > 0) {
            // Group by day
            const dailyActivity: { [key: string]: number } = {};
            const last7Days = Array.from({ length: 7 }, (_, i) => {
                const date = new Date();
                date.setDate(date.getDate() - i);
                return date.toISOString().split('T')[0];
            }).reverse();

            // Initialize all days to 0
            last7Days.forEach(day => {
                dailyActivity[day] = 0;
            });

            // Count activity per day
            recentActivity.forEach((activity: any) => {
                const day = activity.updatedAt.toISOString().split('T')[0];
                if (Object.prototype.hasOwnProperty.call(dailyActivity, day)) {
                    dailyActivity[day]++;
                }
            });

            const activeMembers = new Set(recentActivity.map((a: any) => a.userId)).size;

            embed.addFields([
                {
                    name: '📈 Activity (Last 7 Days)',
                    value: [
                        `**Active Members:** ${activeMembers}`,
                        `**Total Activity:** ${recentActivity.length}`,
                        `**Daily Average:** ${Math.round(recentActivity.length / 7)}`,
                    ].join('\n'),
                    inline: true,
                },
            ]);

            // Generate activity chart
            const chartConfig = {
                type: 'line' as const,
                data: {
                    labels: last7Days.map(day => {
                        const date = new Date(day);
                        return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
                    }),
                    datasets: [{
                        label: 'Member Activity',
                        data: last7Days.map(day => dailyActivity[day]),
                        borderColor: '#7289DA',
                        backgroundColor: 'rgba(114, 137, 218, 0.2)',
                        tension: 0.4,
                        fill: true,
                    }],
                },
                options: {
                    responsive: true,
                    plugins: {
                        title: {
                            display: true,
                            text: 'Member Activity - Last 7 Days',
                            color: '#FFFFFF',
                            font: { size: 16 },
                        },
                        legend: {
                            display: false,
                        },
                    },
                    scales: {
                        y: {
                            beginAtZero: true,
                            ticks: { color: '#FFFFFF' },
                            grid: { color: '#4F545C' },
                        },
                        x: {
                            ticks: { color: '#FFFFFF' },
                            grid: { color: '#4F545C' },
                        },
                    },
                    backgroundColor: '#2C2F33',
                },
            };

            const chartCanvas = new ChartJSNodeCanvas({
                width: CHART_WIDTH,
                height: CHART_HEIGHT,
                backgroundColour: '#2C2F33',
            });

            const chartBuffer = await chartCanvas.renderToBuffer(chartConfig);
            const chartAttachment = new AttachmentBuilder(chartBuffer, { name: 'activity-chart.png' });

            return [chartAttachment];
        }
    } catch (error) {
        context.log.error('Error generating activity stats:', error);
    }

    return [];
}