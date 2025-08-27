import { EmbedBuilder, SlashCommandBuilder } from "discord.js";

export default {
    data: new SlashCommandBuilder()
        .setName('poll')
        .setDescription('Poll commands')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a poll with emoji reactions')
                .addStringOption(option =>
                    option.setName('question')
                        .setDescription('The poll question')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('options')
                        .setDescription('Poll options separated by commas (max 10)')
                        .setRequired(true))
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Poll duration in minutes (default: 60)')
                        .setMinValue(1)
                        .setMaxValue(1440))) // Max 24 hours
        .addSubcommand(subcommand =>
            subcommand
                .setName('results')
                .setDescription('View poll results')
                .addStringOption(option =>
                    option.setName('message_id')
                        .setDescription('The poll message ID')
                        .setRequired(true))),

    async execute(interaction: any, context: any) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await handleCreateCommand(interaction, context);
                    break;
                case 'results':
                    await handleResultsCommand(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            context.log.error('Error executing poll command', { error, subcommand, userId: interaction.user.id });
            if (interaction.replied) {
                await interaction.followUp({
                    content: 'An error occurred while executing the command.',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
            }
        }
    },
};

async function handleCreateCommand(interaction: any, context: any) {
    const question = interaction.options.getString('question');
    const optionsString = interaction.options.getString('options');
    const duration = interaction.options.getInteger('duration') || 60;

    // Parse options
    const options = optionsString.split(',').map((opt: string) => opt.trim()).filter((opt: string) => opt.length > 0);

    if (options.length < 2) {
        await interaction.reply({
            content: 'Please provide at least 2 poll options separated by commas.',
            ephemeral: true,
        });
        return;
    }

    if (options.length > 10) {
        await interaction.reply({ content: 'Maximum 10 poll options allowed.', ephemeral: true });
        return;
    }

    // Create poll embed
    const pollEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📊 ${question}`)
        .setDescription(options.map((option: string, index: number) => {
            const emoji = getEmojiForIndex(index);
            return `${emoji} ${option}`;
        }).join('\n'))
        .addFields(
            { name: 'Duration', value: `${duration} minutes`, inline: true },
            { name: 'Created by', value: `<@${interaction.user.id}>`, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'React with emojis to vote!' });

    const pollMessage = await interaction.reply({ embeds: [pollEmbed], fetchReply: true });

    // Add emoji reactions
    for (let i = 0; i < options.length; i++) {
        const emoji = getEmojiForIndex(i);
        await pollMessage.react(emoji);
    }

    // Store poll in database
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + duration);

    await context.tables.Poll.create({
        message_id: pollMessage.id,
        channel_id: interaction.channelId,
        guild_id: interaction.guildId,
        creator_id: interaction.user.id,
        question: question,
        options: JSON.stringify(options),
        expires_at: expiresAt,
        is_active: true,
    });

    context.log.info('Poll created successfully', {
        pollId: pollMessage.id,
        question: question,
        optionCount: options.length,
        duration: duration,
        creator: interaction.user.id,
    });
}

async function handleResultsCommand(interaction: any, context: any) {
    const messageId = interaction.options.getString('message_id');

    // Find the poll
    const poll = await context.tables.Poll.findOne({
        where: { message_id: messageId },
    });

    if (!poll) {
        await interaction.reply({ content: 'Poll not found.', ephemeral: true });
        return;
    }

    // Get vote counts
    const votes = await context.tables.PollVote.findAll({
        where: { poll_id: poll.id },
        attributes: ['option_index', [context.sequelize.fn('COUNT', context.sequelize.col('user_id')), 'count']],
        group: ['option_index'],
        raw: true,
    });

    const options = JSON.parse(poll.options);
    const totalVotes = await context.tables.PollVote.count({ where: { poll_id: poll.id } });

    // Create vote count map
    const voteCounts = new Map<number, number>();
    votes.forEach((vote: any) => {
        voteCounts.set(vote.option_index, parseInt(vote.count));
    });

    // Build results embed
    const resultsEmbed = new EmbedBuilder()
        .setColor('#00ff00')
        .setTitle(`📊 Poll Results: ${poll.question}`)
        .setDescription(options.map((option: string, index: number) => {
            const emoji = getEmojiForIndex(index);
            const count = voteCounts.get(index) || 0;
            const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const bar = createProgressBar(percentage);
            return `${emoji} **${option}**\n${bar} ${count} votes (${percentage}%)`;
        }).join('\n\n'))
        .addFields(
            { name: 'Total Votes', value: totalVotes.toString(), inline: true },
            {
                name: 'Status',
                value: poll.is_active && new Date() < new Date(poll.expires_at)
                    ? '🟢 Active' : '🔴 Ended',
                inline: true,
            },
        )
        .setTimestamp()
        .setFooter({ text: `Created by ${poll.creator_id}` });

    await interaction.reply({ embeds: [resultsEmbed] });
}

function createProgressBar(percentage: number): string {
    const totalBars = 10;
    const filledBars = Math.round((percentage / 100) * totalBars);
    const emptyBars = totalBars - filledBars;

    return '▓'.repeat(filledBars) + '░'.repeat(emptyBars);
}

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '❓';
}