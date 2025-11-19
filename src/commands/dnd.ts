import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Context } from '../types';
import { DndGameAttributes } from '../types/database';
import { safelySendToChannel } from '../utils/discordHelpers';

const DEFAULT_SYSTEM_PROMPT = "You are running a MUD-like D&D campaign for my friends and I. " +
    "We'll type in responses and you will use your context to respond with engaging, immersive " +
    "storytelling. Keep responses under 2000 characters to fit Discord message limits.";

const dndCommand = {
    data: new SlashCommandBuilder()
        .setName('dnd')
        .setDescription('Manage D&D game sessions')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create and start a new D&D game in this channel')
                .addStringOption(option => option
                    .setName('name')
                    .setDescription('Name of the game')
                    .setRequired(true))
                .addStringOption(option => option
                    .setName('prompt')
                    .setDescription('World-building prompt (setting, theme, rules)')
                    .setRequired(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('resume')
                .setDescription('Resume a saved game in this channel')
                .addStringOption(option => option
                    .setName('name')
                    .setDescription('Name of the game to resume')
                    .setRequired(true)
                    .setAutocomplete(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all saved D&D games'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('off')
                .setDescription('End the active game and save it'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Permanently delete a saved game')
                .addStringOption(option => option
                    .setName('name')
                    .setDescription('Name of the game to delete')
                    .setRequired(true)
                    .setAutocomplete(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configure D&D game settings')
                .addIntegerOption(option => option
                    .setName('wait-period')
                    .setDescription('Wait period in minutes before responding (1-30)')
                    .setMinValue(1)
                    .setMaxValue(30)
                    .setRequired(false)),
        ),

    async autocomplete(interaction: any, context: Context) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'name') {
            try {
                const guildId = interaction.guildId;

                context.log.debug('D&D autocomplete requested', {
                    guildId,
                    focusedValue: focusedOption.value,
                    subcommand: interaction.options.getSubcommand(),
                });

                // Find saved games (not currently active in any channel)
                const games = await context.tables.DndGame.findAll({
                    where: {
                        guildId,
                        channelId: null,
                    },
                    limit: 25,
                    order: [['updatedAt', 'DESC']],
                });

                context.log.debug('D&D autocomplete query results', {
                    guildId,
                    totalGames: games.length,
                    gameNames: (games as unknown as DndGameAttributes[]).map(g => g.name),
                });

                const filtered = (games as unknown as DndGameAttributes[])
                    .filter((game: DndGameAttributes) =>
                        game.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
                    )
                    .slice(0, 25);

                context.log.debug('D&D autocomplete filtered results', {
                    guildId,
                    filteredCount: filtered.length,
                    filteredNames: filtered.map(g => g.name),
                });

                await interaction.respond(
                    filtered.map((game: DndGameAttributes) => ({
                        name: game.name,
                        value: game.name,
                    })),
                );
            } catch (error) {
                context.log.error({ error }, 'Error in D&D game autocomplete');
                await interaction.respond([]);
            }
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        try {
            const subcommand = interaction.options.getSubcommand();

            switch (subcommand) {
                case 'create':
                    await handleCreateGame(interaction, context);
                    break;
                case 'resume':
                    await handleResumeGame(interaction, context);
                    break;
                case 'list':
                    await handleListGames(interaction, context);
                    break;
                case 'off':
                    await handleOffGame(interaction, context);
                    break;
                case 'delete':
                    await handleDeleteGame(interaction, context);
                    break;
                case 'config':
                    await handleConfig(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            context.log.error({ error }, 'Error in D&D command');
            const errorMessage = 'An error occurred while processing the D&D command.';

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

async function handleCreateGame(interaction: ChatInputCommandInteraction, context: Context) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!guildId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
    }

    const name = interaction.options.getString('name', true);
    const worldPrompt = interaction.options.getString('prompt', true);

    try {
        // Check if this channel already has an active game
        const activeGameInChannel = await context.tables.DndGame.findOne({
            where: { guildId, channelId, isActive: true },
        }) as unknown as DndGameAttributes | null;

        if (activeGameInChannel) {
            await interaction.editReply(
                `This channel already has an active game: **${activeGameInChannel.name}**\n\n`
                + 'Use `/dnd off` to end it first.',
            );
            return;
        }

        // Build system prompt with world-building
        const systemPrompt = `${DEFAULT_SYSTEM_PROMPT}\n\nWorld Setting: ${worldPrompt}`;

        // Generate opening scene using OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });

        const introMessage = {
            role: 'user' as const,
            content: 'Begin the adventure with an engaging introduction to this world. Set the scene for the players.',
        };

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                { role: 'system' as const, content: systemPrompt },
                introMessage,
            ],
            max_tokens: 300,
            temperature: 0.8,
        });

        const introResponse = completion.choices[0].message.content;

        if (!introResponse) {
            await interaction.editReply('Failed to generate opening scene.');
            return;
        }

        // Create and save the game
        const conversationHistory = [
            { role: 'system' as const, content: systemPrompt },
            introMessage,
            { role: 'assistant' as const, content: introResponse },
        ];

        await context.tables.DndGame.create({
            guildId,
            name,
            systemPrompt,
            conversationHistory: conversationHistory as any,
            channelId,
            isActive: true,
            waitPeriodMinutes: 5,
            currentRound: 1,
            pendingMessages: [] as any,
            lastResponseTime: new Date(),
        } as any);

        // Send intro message to channel
        const channel = await interaction.client.channels.fetch(channelId);
        if (channel && 'send' in channel) {
            await safelySendToChannel(
                channel as any,
                `🎲 **${name}**\n\n${introResponse}`,
                context,
                'D&D game intro',
            );
        }

        await interaction.editReply(
            `✅ Game created and started!\n\nThis channel is now locked to **${name}**.\n`
            + 'Use `/dnd off` to end the session.',
        );
    } catch (error) {
        context.log.error({ error, guildId, name }, 'Failed to create D&D game');

        let errorMessage = 'Failed to create game. Please try again.';

        // Handle specific database validation errors
        if (error && typeof error === 'object' && 'message' in error) {
            const errorMsg = String(error.message);

            // Name too long
            if (errorMsg.includes('Data too long for column \'name\'')) {
                errorMessage = `❌ Game name is too long (max 100 characters).\n\nYour name: ${name.length} characters`;
            }
        }

        await interaction.editReply(errorMessage);
    }
}

async function handleOffGame(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    try {
        // Find active game in this channel
        const game = await context.tables.DndGame.findOne({
            where: { guildId, channelId },
        }) as unknown as DndGameAttributes | null;

        if (!game) {
            await interaction.reply({
                content: 'No active game in this channel.',
                ephemeral: true,
            });
            return;
        }

        // Save the game and unlock channel
        await context.tables.DndGame.update(
            { channelId: null, isActive: false },
            { where: { guildId, channelId } },
        );

        await interaction.reply({
            content: `✅ Game **${game.name}** saved and channel unlocked.\n\n`
                + `Rounds played: ${game.currentRound}\n`
                + `Use \`/dnd resume name:"${game.name}"\` to continue later.`,
            ephemeral: true,
        });
    } catch (error) {
        context.log.error({ error, guildId }, 'Failed to turn off D&D game');
        await interaction.reply({ content: 'Failed to turn off game. Please try again.', ephemeral: true });
    }
}

async function handleResumeGame(interaction: ChatInputCommandInteraction, context: Context) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!guildId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
    }

    const name = interaction.options.getString('name', true);

    try {
        // Check if this channel already has an active game
        const activeGameInChannel = await context.tables.DndGame.findOne({
            where: { guildId, channelId, isActive: true },
        }) as unknown as DndGameAttributes | null;

        if (activeGameInChannel) {
            await interaction.editReply(
                `This channel already has an active game: **${activeGameInChannel.name}**\n\n`
                + 'Use `/dnd off` to end it first.',
            );
            return;
        }

        // Find the saved game
        const game = await context.tables.DndGame.findOne({
            where: { guildId, name, channelId: null },
        }) as unknown as DndGameAttributes | null;

        if (!game) {
            await interaction.editReply(`Game "${name}" not found or is already active in another channel.`);
            return;
        }

        // Generate recap using OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });

        const recapMessage = {
            role: 'user' as const,
            content: 'Provide a brief recap of the story so far to remind the players '
                + 'where they left off. Keep it concise and engaging.',
        };

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages: [
                ...(game.conversationHistory as any[]),
                recapMessage,
            ],
            max_tokens: 300,
            temperature: 0.7,
        });

        const recapResponse = completion.choices[0].message.content;

        if (!recapResponse) {
            await interaction.editReply('Failed to generate recap.');
            return;
        }

        // Update game with new channel and add recap to history
        const updatedHistory = [
            ...(game.conversationHistory as any[]),
            recapMessage,
            { role: 'assistant' as const, content: recapResponse },
        ];

        await context.tables.DndGame.update(
            {
                channelId,
                conversationHistory: updatedHistory as any,
                lastResponseTime: new Date(),
            },
            { where: { guildId, name } },
        );

        // Send recap to channel
        const channel = await interaction.client.channels.fetch(channelId);
        if (channel && 'send' in channel) {
            await safelySendToChannel(
                channel as any,
                `🎲 **${game.name}** (Round ${game.currentRound})\n\n📖 **Recap:**\n${recapResponse}`,
                context,
                'D&D game recap',
            );
        }

        await interaction.editReply(
            `✅ Resumed **${game.name}**!\n\nThis channel is now locked to this game.\n`
            + 'Use `/dnd off` to save and end the session.',
        );
    } catch (error) {
        context.log.error({ error, guildId, name }, 'Failed to resume D&D game');
        await interaction.editReply('Failed to resume game. Please try again.');
    }
}

async function handleListGames(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    try {
        const games = await context.tables.DndGame.findAll({
            where: { guildId },
            order: [['channelId', 'DESC'], ['updatedAt', 'DESC']],
        }) as unknown as DndGameAttributes[];

        if (games.length === 0) {
            await interaction.reply({
                content: 'No D&D games found. Use `/dnd create` to create one.',
                ephemeral: true,
            });
            return;
        }

        const activeGames = games.filter(g => g.channelId);
        const savedGames = games.filter(g => !g.channelId);

        let description = '';

        if (activeGames.length > 0) {
            description += '**🎮 Active Games:**\n';
            description += activeGames.map(game =>
                `• **${game.name}** - <#${game.channelId}> (Round ${game.currentRound})`,
            ).join('\n');
        }

        if (savedGames.length > 0) {
            if (description) {description += '\n\n';}
            description += '**💾 Saved Games:**\n';
            description += savedGames.map(game =>
                `• **${game.name}** (Round ${game.currentRound})`,
            ).join('\n');
        }

        const embed = {
            title: '🎲 D&D Games',
            description,
            color: 0xFF6B6B,
            footer: {
                text: `Total: ${games.length} games (${activeGames.length} active, ${savedGames.length} saved)`,
            },
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        context.log.error({ error, guildId }, 'Error listing D&D games');
        await interaction.reply({ content: 'Failed to list games.', ephemeral: true });
    }
}

async function handleDeleteGame(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const name = interaction.options.getString('name', true);

    try {
        context.log.info('Attempting to delete D&D game', { guildId, name });

        const game = await context.tables.DndGame.findOne({
            where: { guildId, name },
        }) as unknown as DndGameAttributes | null;

        if (!game) {
            context.log.warn('Delete failed - game not found', { guildId, name });
            await interaction.reply({ content: `Game "${name}" not found.`, ephemeral: true });
            return;
        }

        context.log.info('Found game to delete', {
            guildId,
            name,
            gameId: game.id,
            channelId: game.channelId,
            isActive: game.isActive,
        });

        if (game.channelId) {
            context.log.warn('Delete rejected - game is active', {
                guildId,
                name,
                channelId: game.channelId,
            });
            await interaction.reply({
                content: `Game **${game.name}** is currently active in <#${game.channelId}>.\n\n`
                    + 'Use `/dnd off` in that channel first.',
                ephemeral: true,
            });
            return;
        }

        const deleteCount = await context.tables.DndGame.destroy({
            where: { guildId, name },
        });

        context.log.info('Game deletion completed', {
            guildId,
            name,
            deletedCount: deleteCount,
        });

        await interaction.reply({
            content: `🗑️ Permanently deleted game: **${name}**`,
            ephemeral: true,
        });
    } catch (error) {
        context.log.error({ error, guildId, name }, 'Failed to delete D&D game');
        await interaction.reply({ content: 'Failed to delete game. Please try again.', ephemeral: true });
    }
}

async function handleConfig(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;
    const channelId = interaction.channelId;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const waitPeriod = interaction.options.getInteger('wait-period');

    try {
        // Find active game in this channel
        const game = await context.tables.DndGame.findOne({
            where: { guildId, channelId },
        }) as unknown as DndGameAttributes | null;

        if (!game) {
            await interaction.reply({
                content: 'No active game in this channel.',
                ephemeral: true,
            });
            return;
        }

        if (waitPeriod === null) {
            await interaction.reply({
                content: 'Please specify the wait-period option.',
                ephemeral: true,
            });
            return;
        }

        await context.tables.DndGame.update(
            { waitPeriodMinutes: waitPeriod },
            { where: { guildId, channelId } },
        );

        await interaction.reply({
            content: `✅ Updated configuration for **${game.name}**:\nWait period: ${waitPeriod} minutes`,
            ephemeral: true,
        });
    } catch (error) {
        context.log.error({ error, guildId }, 'Failed to configure D&D game');
        await interaction.reply({ content: 'Failed to update configuration.', ephemeral: true });
    }
}

export default dndCommand;
