import { AttachmentBuilder, EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { ChartJSNodeCanvas } from "chartjs-node-canvas";
import { Op } from "sequelize";
import { uniq } from "lodash";

const scale = 2; // Scale of the graph
const width = 400 / scale; // Width of the graph
const height = 200 / scale; // Height of the graph

export default {
    data: new SlashCommandBuilder()
        .setName('rc')
        .setDescription('Roll Call command')
        .addSubcommand((subcommand: any) => subcommand
            .setName('for')
            .setDescription('Get RC score for a user')
            .addStringOption((option: any) => option
                .setName('username')
                .setDescription('Enter a username')
                .setAutocomplete(true)
                .setRequired(true))
            .addStringOption((option: any) => option
                .setName('interval')
                .setDescription('Enter time interval (e.g., 3h, 2d)')))
        .addSubcommand((subcommand: any) => subcommand
            .setName('graph')
            .setDescription('Show RC graph for a user')
            .addStringOption((option: any) => option
                .setName('username')
                .setDescription('Enter a username')
                .setAutocomplete(true)
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('set')
            .setDescription('Set your RC score')
            .addNumberOption((option: any) => option
                .setName('score')
                .setDescription('Enter your score')
                .setRequired(true))),
    async autocomplete(interaction: any, context: any) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'username') {
            const search = focusedOption.value;
            const users = await context.tables.RollCall.findAll({
                where: {
                    username: { [Op.like]: `%${search}%` },
                },
                limit: 5,
            });

            const usernames = users.map((user: any) => user.username);
            const uniqUsernames = uniq(usernames);

            await interaction.respond(uniqUsernames.map((username: any) => ({
                name: username,
                value: username,
            })));
        }
    },
    async execute(interaction: any, context: any) {
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

async function handleForCommand(interaction: any, context: any) {
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

async function handleGraphCommand(interaction: any, context: any) {
    const username = interaction.options.getString('username');
    // trim the excess scores down to the first 10
    const allScores = await fetchScores(username, null, context);
    const scores = allScores.slice(0, 10);
    if (scores.length === 0) {
        await interaction.reply({ content: `No scores found for ${username}`, ephemeral: true });
        return;
    }

    const chartBuffer = await generateSparkline(scores);
    const attachment = new AttachmentBuilder(chartBuffer, { name: 'graph.png' });
    await interaction.reply({ files: [attachment] });
}

async function handleSetCommand(interaction: any, context: any) {
    const user = interaction.user;
    const score = interaction.options.getNumber('score');

    if (score < 0 || score > 100) {
        // database still validates but still.
        await interaction.reply({ content: 'Score must be between 0 and 100', ephemeral: true });
        return;
    }

    await context.tables.RollCall.create({
        username: user.username,
        value: score,
        timestamp: new Date(),
    });
    await interaction.reply({ content: `Your roll call has been set to ${score}`, ephemeral: true });
}

async function generateSparkline(scores: any) {
    const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });

    const data = {
        labels: scores.map((score: any) => score.timestamp.toLocaleString()),
        datasets: [
            // Shadow/outline dataset (black line underneath)
            {
                label: 'Roll Call Score Shadow',
                data: scores.map((score: any) => score.value),
                borderColor: 'rgba(0, 0, 0, 1)',
                fill: false,
                tension: 0.2,
                borderWidth: 3,
                pointRadius: 0,
                pointHoverRadius: 0,
            },
            // Main line dataset (white line on top)
            {
                label: 'Roll Call Score',
                data: scores.map((score: any) => score.value),
                borderColor: 'rgba(255, 255, 255, 1)',
                fill: false,
                tension: 0.2,
                borderWidth: 1,
                pointRadius: 0,
                pointHoverRadius: 0,
            },
        ],
    };

    const options = {
        scales: {
            x: { display: false },
            y: { display: false },
        },
        plugins: {
            legend: { display: false },
        },
        devicePixelRatio: 1,
    };

    return chartJSNodeCanvas.renderToBuffer({ type: 'line', data, options });
}

async function fetchScores(username: any, interval: any, context: any) {
    const whereClause = { username, timestamp: { [Op.gte]: new Date(0) } };
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

function parseInterval(interval: any) {
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