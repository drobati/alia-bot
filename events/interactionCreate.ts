import { CommandInteraction, Events, Interaction, ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
import { Command, Context, BotEvent, ExtendedClient } from "../src/utils/types";
import { Sentry } from "../src/lib/sentry";
import { DndGameAttributes, SkillCheckVote } from "../src/types/database";
import { createSkillCheckEmbed, OPTION_LABELS } from "../src/responses/dnd";

const interactionCreateEventHandler: BotEvent = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction, context: Context) {
        const { log } = context;

        // Handle button interactions for polls
        if (interaction.isButton() && interaction.customId.startsWith('poll_vote_')) {
            await handlePollVote(interaction, context);
            return;
        }

        // Handle button interactions for D&D skill checks
        if (interaction.isButton() && interaction.customId.startsWith('dnd_skill_')) {
            await handleDndSkillVote(interaction, context);
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

            // Capture error to Sentry with context
            Sentry.captureException(error, {
                tags: {
                    handler: 'interactionCreate',
                    command: interaction.isChatInputCommand() ? interaction.commandName : 'unknown',
                },
                extra: {
                    userId: interaction.user?.id,
                    guildId: interaction.guildId,
                    interactionType: interaction.type,
                },
            });

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

async function handleDndSkillVote(interaction: any, context: Context) {
    try {
        // Parse button custom ID: dnd_skill_{gameId}_{optionIndex}
        const parts = interaction.customId.split('_');
        if (parts.length !== 4) {
            return;
        }

        const gameId = parseInt(parts[2]);
        const optionIndex = parseInt(parts[3]);

        if (isNaN(gameId) || isNaN(optionIndex) || optionIndex < 0 || optionIndex > 3) {
            await interaction.reply({ content: 'Invalid vote.', ephemeral: true });
            return;
        }

        // Find the game with active skill check
        const game = await context.tables.DndGame.findOne({
            where: { id: gameId },
        }) as unknown as DndGameAttributes | null;

        if (!game || !game.pendingSkillCheck) {
            await interaction.reply({ content: 'This skill check has already ended.', ephemeral: true });
            return;
        }

        // Check if skill check has expired
        if (game.skillCheckExpiresAt && new Date() > new Date(game.skillCheckExpiresAt)) {
            await interaction.reply({ content: 'This skill check has expired.', ephemeral: true });
            return;
        }

        const userId = interaction.user.id;
        const username = interaction.user.displayName || interaction.user.username;

        // Get current votes
        const currentVotes: Record<string, SkillCheckVote> = game.skillCheckVotes || {};

        // Check if user already voted
        const existingVote = currentVotes[userId];
        if (existingVote) {
            // Update their vote
            currentVotes[userId] = { optionIndex, username };
            await interaction.reply({
                content: `Vote changed to **${OPTION_LABELS[optionIndex]}**!`,
                ephemeral: true,
            });
        } else {
            // New vote
            currentVotes[userId] = { optionIndex, username };
            await interaction.reply({
                content: `Vote recorded for **${OPTION_LABELS[optionIndex]}**!`,
                ephemeral: true,
            });
        }

        // Update the votes in the database
        await context.tables.DndGame.update(
            { skillCheckVotes: currentVotes as any },
            { where: { id: gameId } },
        );

        // Update the embed to show new vote counts
        const { embed, row } = createSkillCheckEmbed(
            game.pendingSkillCheck,
            gameId,
            game.name,
            currentVotes,
        );

        // Update time remaining in footer
        if (game.skillCheckExpiresAt) {
            const remainingMs = new Date(game.skillCheckExpiresAt).getTime() - Date.now();
            const remainingSec = Math.max(0, Math.ceil(remainingMs / 1000));
            embed.setFooter({ text: `${game.name} | Vote ends in ${remainingSec} seconds` });
        }

        try {
            await interaction.message.edit({
                embeds: [embed],
                components: [row],
            });
        } catch (editError) {
            context.log.error('Failed to update skill check message', { error: editError, gameId });
        }

        context.log.info('D&D skill check vote recorded', {
            gameId,
            gameName: game.name,
            userId,
            optionIndex,
            totalVotes: Object.keys(currentVotes).length,
        });

    } catch (error) {
        context.log.error('Error handling D&D skill vote', { error, userId: interaction.user.id });
        if (!interaction.replied) {
            await interaction.reply({ content: 'An error occurred while recording your vote.', ephemeral: true });
        }
    }
}

export default interactionCreateEventHandler;
