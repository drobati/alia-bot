import { CommandInteraction, Events, Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Command, Context, BotEvent, ExtendedClient } from "../src/utils/types";

const interactionCreateEventHandler: BotEvent = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction, context: Context) {
        const { log } = context;

        // Log ALL incoming interactions for debugging
        log.info('Interaction received', {
            type: interaction.type,
            commandName: interaction.isChatInputCommand() ? interaction.commandName : 'N/A',
            userId: interaction.user?.id,
            guildId: interaction.guildId,
            channelId: interaction.channelId,
        });

        // Handle button interactions for polls
        if (interaction.isButton() && interaction.customId.startsWith('poll_vote_')) {
            await handlePollVote(interaction, context);
            return;
        }

        // Handle button interactions for betting
        if (interaction.isButton() && interaction.customId.startsWith('bet_join_')) {
            await handleBetJoin(interaction, context);
            return;
        }

        if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
            log.error(`Interaction type ${interaction.type}} is not a chat input command or autocomplete`);
            return;
        }

        const command = (interaction.client as ExtendedClient).commands
            .get(interaction.commandName) as Command | undefined;

        if (!command) {
            log.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            if (interaction.isAutocomplete()) {
                if (command && command.autocomplete) {
                    log.info(`Autocompleting ${interaction.commandName}`);
                    await command.autocomplete(interaction, context);
                } else {
                    log.error(`Autocomplete command not found for ${interaction.commandName}`);
                }
            }
            else if (interaction.isCommand()) {
                log.info(`Executing ${interaction.commandName}`);
                await command.execute(interaction, context);
            }
        } catch (error) {
            log.error(error);
            if (interaction instanceof CommandInteraction) {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: 'There was an error while executing this command!',
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: 'There was an error while executing this command!',
                        ephemeral: true,
                    });
                }
            } else {
                log.error('Interaction type does not support replied or deferred properties.');
            }
        }
    },
};

async function handlePollVote(interaction: any, context: Context) {
    try {
        // Parse button custom ID: poll_vote_{pollId}_{optionIndex}
        const parts = interaction.customId.split('_');
        if (parts.length !== 4) {return;}

        const pollId = parts[2];
        const optionIndex = parseInt(parts[3]);

        // Find the poll
        const poll = await context.tables.Poll.findOne({
            where: {
                poll_id: pollId,
                is_active: true,
            },
        });

        if (!poll) {
            await interaction.reply({ content: 'This poll is no longer active.', ephemeral: true });
            return;
        }

        // Check if poll has expired
        if (new Date() > new Date(poll.expires_at)) {
            await context.tables.Poll.update(
                { is_active: false },
                { where: { id: poll.id } },
            );
            await interaction.reply({ content: 'This poll has expired.', ephemeral: true });
            return;
        }

        // Store or update the vote
        await context.tables.PollVote.upsert({
            poll_id: poll.id,
            user_id: interaction.user.id,
            option_index: optionIndex,
            voted_at: new Date(),
        });

        // Get updated vote counts
        const votes = await context.tables.PollVote.findAll({
            where: { poll_id: poll.id },
            attributes: ['option_index', [context.sequelize.fn('COUNT', context.sequelize.col('user_id')), 'count']],
            group: ['option_index'],
            raw: true,
        });

        const options = JSON.parse(poll.options);
        const voteCounts = new Map<number, number>();
        votes.forEach((vote: any) => {
            voteCounts.set(vote.option_index, parseInt(vote.count));
        });

        // Update button labels with new vote counts
        const voteButtons = options.map((option: string, index: number) => {
            const emoji = getEmojiForIndex(index);
            const count = voteCounts.get(index) || 0;
            return new ButtonBuilder()
                .setCustomId(`poll_vote_${pollId}_${index}`)
                .setLabel(`${emoji} ${count}`)
                .setStyle(ButtonStyle.Secondary);
        });

        // Create action rows
        const actionRows = [];
        for (let i = 0; i < voteButtons.length; i += 5) {
            const row = new ActionRowBuilder<ButtonBuilder>()
                .addComponents(voteButtons.slice(i, i + 5));
            actionRows.push(row);
        }

        // Update the original message with new vote counts
        await interaction.update({
            components: actionRows,
        });

        context.log.info('Poll vote recorded and buttons updated', {
            pollId: poll.id,
            userId: interaction.user.id,
            optionIndex: optionIndex,
        });

    } catch (error) {
        context.log.error('Error handling poll vote', { error, userId: interaction.user.id });
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while recording your vote.', ephemeral: true });
        }
    }
}

function getEmojiForIndex(index: number): string {
    const emojis = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣', '🔟'];
    return emojis[index] || '❓';
}

async function handleBetJoin(interaction: any, context: Context) {
    try {
        // Parse button custom ID: bet_join_{betId}
        const parts = interaction.customId.split('_');
        if (parts.length !== 3) {
            await interaction.reply({ content: 'Invalid button interaction.', ephemeral: true });
            return;
        }

        const betId = parts[2];

        // Find the bet
        const bet = await context.tables.BetWagers.findByPk(betId);
        if (!bet) {
            await interaction.reply({ content: 'This bet no longer exists.', ephemeral: true });
            return;
        }

        // Check if bet is still open
        if (bet.status !== 'open') {
            await interaction.reply({ content: 'This bet is no longer accepting participants.', ephemeral: true });
            return;
        }

        // Check if bet has closed
        if (new Date() > new Date(bet.closes_at)) {
            await interaction.reply({ content: 'This bet has closed.', ephemeral: true });
            return;
        }

        // Reply with betting options - present a modal or follow-up for side and amount selection
        await interaction.reply({
            content: `🎲 **Join Bet: "${bet.statement}"**\n\nTo join this bet, use the command:\n\`/bet join bet_id:${betId} side:for amount:10\`\n\n**Options:**\n• \`side:for\` or \`side:against\`\n• Choose your Sparks amount\n\n**Current Odds:** ${bet.odds_for}:${bet.odds_against}`,
            ephemeral: true,
        });

        context.log.info('Bet join button clicked', {
            betId: bet.id,
            userId: interaction.user.id,
            statement: bet.statement,
        });

    } catch (error) {
        context.log.error('Error handling bet join button', { error, userId: interaction.user.id });
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while processing your request.', ephemeral: true });
        }
    }
}

export default interactionCreateEventHandler;
