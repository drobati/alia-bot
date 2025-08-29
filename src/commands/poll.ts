import { EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";

function generateShortId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

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
                    option.setName('poll_id')
                        .setDescription('The poll ID (shown in the poll embed)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your active polls in this channel'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('close')
                .setDescription('Manually close one of your polls')
                .addStringOption(option =>
                    option.setName('poll_id')
                        .setDescription('The poll ID (shown in the poll embed)')
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
                case 'list':
                    await handleListCommand(interaction, context);
                    break;
                case 'close':
                    await handleCloseCommand(interaction, context);
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

    // Generate unique short poll ID
    let pollId: string;
    let attempts = 0;
    do {
        pollId = generateShortId();
        attempts++;
        if (attempts > 10) {
            throw new Error('Failed to generate unique poll ID');
        }
    } while (await context.tables.Poll.findOne({ where: { poll_id: pollId } }));

    // Create poll embed with choices
    const choicesText = options.map((option: string, index: number) => {
        const emoji = getEmojiForIndex(index);
        return `${emoji} **${option}**`;
    }).join('\n\n');

    const pollEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle(`📊 ${question}`)
        .setDescription(choicesText)
        .addFields(
            { name: 'Settings', value: `⏱️ ${duration} minutes\n🔢 1 allowed choice`, inline: true },
            { name: 'Poll ID', value: `\`${pollId}\``, inline: true },
        )
        .setTimestamp()
        .setFooter({ text: 'Click buttons to vote!' });

    // Create vote buttons
    const voteButtons = options.map((option: string, index: number) => {
        const emoji = getEmojiForIndex(index);
        return new ButtonBuilder()
            .setCustomId(`poll_vote_${pollId}_${index}`)
            .setLabel(`${emoji} 0`)
            .setStyle(ButtonStyle.Secondary);
    });

    // Create action rows (Discord allows max 5 buttons per row)
    const actionRows = [];
    for (let i = 0; i < voteButtons.length; i += 5) {
        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(voteButtons.slice(i, i + 5));
        actionRows.push(row);
    }

    const pollMessage = await interaction.reply({ 
        embeds: [pollEmbed], 
        components: actionRows,
        fetchReply: true 
    });

    // Store poll in database
    const expiresAt = new Date();
    expiresAt.setMinutes(expiresAt.getMinutes() + duration);

    await context.tables.Poll.create({
        poll_id: pollId,
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
    const pollId = interaction.options.getString('poll_id');

    // Find the poll - try poll_id first, then message_id for backward compatibility
    let poll = await context.tables.Poll.findOne({
        where: { poll_id: pollId },
    });
    
    if (!poll) {
        // Try as message_id for legacy polls
        poll = await context.tables.Poll.findOne({
            where: { message_id: pollId },
        });
    }

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
            {
                name: 'Poll ID',
                value: poll.poll_id ? `\`${poll.poll_id}\`` : `\`${poll.message_id}\` (legacy)`,
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

async function handleListCommand(interaction: any, context: any) {
    // List active polls created by the user in this channel
    const polls = await context.tables.Poll.findAll({
        where: {
            creator_id: interaction.user.id,
            channel_id: interaction.channelId,
            is_active: true,
        },
        order: [['created_at', 'DESC']],
        limit: 10,
    });

    if (polls.length === 0) {
        await interaction.reply({
            content: 'You have no active polls in this channel.',
            ephemeral: true,
        });
        return;
    }

    const listEmbed = new EmbedBuilder()
        .setColor('#0099ff')
        .setTitle('📋 Your Active Polls')
        .setDescription(polls.map((poll: any, index: number) => {
            const timeLeft = Math.round((new Date(poll.expires_at).getTime() - Date.now()) / (1000 * 60));
            const status = timeLeft > 0 ? `${timeLeft}m left` : 'Expired';
            const pollIdDisplay = poll.poll_id ? `📝 Poll ID: \`${poll.poll_id}\`` : `📝 Message ID: \`${poll.message_id}\` (legacy)`;
            return `**${index + 1}.** ${poll.question}\n` +
                   `${pollIdDisplay}\n` +
                   `⏰ ${status}`;
        }).join('\n\n'))
        .setFooter({ text: 'Use /poll results or /poll close with the Poll ID' });

    await interaction.reply({ embeds: [listEmbed], ephemeral: true });
}

async function handleCloseCommand(interaction: any, context: any) {
    const pollId = interaction.options.getString('poll_id');

    // Find the poll and verify ownership - try poll_id first, then message_id for backward compatibility
    let poll = await context.tables.Poll.findOne({
        where: {
            poll_id: pollId,
            creator_id: interaction.user.id,
            is_active: true,
        },
    });
    
    if (!poll) {
        // Try as message_id for legacy polls
        poll = await context.tables.Poll.findOne({
            where: {
                message_id: pollId,
                creator_id: interaction.user.id,
                is_active: true,
            },
        });
    }

    if (!poll) {
        await interaction.reply({
            content: 'Poll not found or you do not have permission to close it.',
            ephemeral: true,
        });
        return;
    }

    // Close the poll
    await context.tables.Poll.update(
        { is_active: false },
        { where: { id: poll.id } }
    );

    // Get final results for the closing message
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

    // Find the winning option(s)
    const maxVotes = Math.max(...Array.from(voteCounts.values()), 0);
    const winners = options.filter((_: string, index: number) => 
        (voteCounts.get(index) || 0) === maxVotes && maxVotes > 0
    );

    const closedEmbed = new EmbedBuilder()
        .setColor('#ff6b6b')
        .setTitle(`🔒 Poll Closed: ${poll.question}`)
        .setDescription(options.map((option: string, index: number) => {
            const emoji = getEmojiForIndex(index);
            const count = voteCounts.get(index) || 0;
            const percentage = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
            const bar = createProgressBar(percentage);
            const isWinner = winners.includes(option) && maxVotes > 0;
            const prefix = isWinner ? '🏆 ' : '';
            return `${prefix}${emoji} **${option}**\n${bar} ${count} votes (${percentage}%)`;
        }).join('\n\n'))
        .addFields(
            { name: 'Total Votes', value: totalVotes.toString(), inline: true },
            { name: 'Winner(s)', value: winners.length > 0 ? winners.join(', ') : 'No votes', inline: true },
        )
        .setTimestamp()
        .setFooter({ text: `Poll closed by ${interaction.user.username}` });

    await interaction.reply({ embeds: [closedEmbed] });
}

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '❓';
}