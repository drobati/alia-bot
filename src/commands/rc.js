const { SlashCommandBuilder, EmbedBuilder, MessageAttachment } = require('discord.js');
const { CanvasRenderService } = require('chartjs-node-canvas');
const { Op } = require('sequelize');

const width = 400; // Width of the graph
const height = 200; // Height of the graph

module.exports = {
    data: new SlashCommandBuilder()
        .setName('rc')
        .setDescription('Roll Call command')
        .addSubcommand(subcommand =>
            subcommand
                .setName('for')
                .setDescription('Get RC score for a user')
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription('Enter a username')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('interval')
                        .setDescription('Enter time interval (e.g., 3h, 2d)')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('graph')
                .setDescription('Show RC graph for a user')
                .addStringOption(option =>
                    option
                        .setName('username')
                        .setDescription('Enter a username')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Set your RC score')
                .addNumberOption(option =>
                    option
                        .setName('score')
                        .setDescription('Enter your score')
                        .setRequired(true))),
    async autocomplete(interaction, context) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'username') {
            const search = focusedOption.value;
            const users = await context.tables.RollCall.findAll({
                where: {
                    username: { [Op.like]: `%${search}%` },
                },
                limit: 5,
            });

            await interaction.respond(users.map(user => ({ name: user.username, value: user.username })));
        }
    },
    async execute(interaction, context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'for':
                    await handleForCommand(interaction, context);
                    break;
                case 'graph':
                    await handleGraphCommand(interaction, context);
                    break;
                case 'set':
                    await handleSetCommand(interaction, context);
                    break;
                default:
                    await interaction.reply('Unknown command');
            }
        } catch (error) {
            context.log.error(error);
            await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
        }
    },
};

async function handleForCommand(interaction, context) {
    const username = interaction.options.getString('username');
    const interval = interaction.options.getString('interval');

    const scores = await fetchScores(username, interval, context);
    if (scores.length === 0) {
        await interaction.reply({ content: `No scores found for ${username}`, ephemeral: true });
        return;
    }

    const lastScore = scores[scores.length - 1];
    const embed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`${username}'s RC Score`)
        .addFields(
            { name: 'Latest Score', value: lastScore.value.toString(), inline: true },
            { name: 'Time', value: new Date(lastScore.timestamp).toLocaleString(), inline: true },
        );

    await interaction.reply({ embeds: [embed] });
}

async function handleGraphCommand(interaction, context) {
    const username = interaction.options.getString('username');
    const scores = await fetchScores(username, null, context);
    if (scores.length === 0) {
        await interaction.reply({ content: `No scores found for ${username}`, ephemeral: true });
        return;
    }

    const chartBuffer = await generateSparkline(scores);
    const attachment = new MessageAttachment(chartBuffer, 'graph.png');
    await interaction.reply({ files: [attachment] });
}

async function handleSetCommand(interaction, context) {
    const user = interaction.user;
    const score = interaction.options.getNumber('score');
    await context.tables.RollCall.create({
        username: user.username,
        value: score,
        timestamp: new Date(),
    });
    await interaction.reply({ content: `Your RC score has been set to ${score}`, ephemeral: true });
}

async function generateSparkline(scores) {
    const canvasRenderService = new CanvasRenderService(width, height, () => {});

    const data = {
        labels: scores.map(score => score.timestamp.toLocaleString()),
        datasets: [{
            label: 'RC Score',
            data: scores.map(score => score.value),
            borderColor: 'rgba(75, 192, 192, 1)',
            borderWidth: 2,
            fill: false,
        }],
    };

    return canvasRenderService.renderToBufferSync({ type: 'line', data });
}

async function fetchScores(username, interval, context) {
    const whereClause = { username };
    if (interval) {
        const now = new Date();
        const pastDate = new Date(now.getTime() - parseInterval(interval));
        whereClause.timestamp = { [Op.gte]: pastDate };
    }

    return await context.tables.RollCall.findAll({
        where: whereClause,
        order: [['timestamp', 'ASC']],
    });
}

function parseInterval(interval) {
    const match = interval.match(/^(\d+)([hmd])$/);
    if (!match) {
        throw new Error('Invalid interval format. Use format like "3h", "2d".');
    }

    const amount = parseInt(match[1], 10);
    const unit = match[2];

    switch (unit) {
        case 'h': // hours
            return amount * 60 * 60 * 1000;
        case 'd': // days
            return amount * 24 * 60 * 60 * 1000;
        case 'm': // minutes
            return amount * 60 * 1000;
        default:
            throw new Error('Invalid time unit. Use "h" for hours, "m" for minutes, or "d" for days.');
    }
}