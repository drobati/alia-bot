import { SlashCommandBuilder, ChatInputCommandInteraction, ChannelType } from 'discord.js';
import { Context } from '../types';
import { DndGameAttributes } from '../types/database';

const DEFAULT_SYSTEM_PROMPT = "You are running a MUD-like D&D campaign for my friends and I. We'll type in responses and you will use your context to respond with engaging, immersive storytelling. Keep responses under 2000 characters to fit Discord message limits.";

const dndCommand = {
    data: new SlashCommandBuilder()
        .setName('dnd')
        .setDescription('Manage D&D game sessions')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new D&D game')
                .addStringOption(option => option
                    .setName('name')
                    .setDescription('Name of the game')
                    .setRequired(true))
                .addStringOption(option => option
                    .setName('prompt')
                    .setDescription('Initial system prompt for the game (optional)')
                    .setRequired(false)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all D&D games'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('switch')
                .setDescription('Switch to a different game')
                .addStringOption(option => option
                    .setName('name')
                    .setDescription('Name of the game to switch to')
                    .setRequired(true)
                    .setAutocomplete(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete a D&D game')
                .addStringOption(option => option
                    .setName('name')
                    .setDescription('Name of the game to delete')
                    .setRequired(true)
                    .setAutocomplete(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('start')
                .setDescription('Start the active game with an initial prompt')
                .addStringOption(option => option
                    .setName('prompt')
                    .setDescription('Opening scene description')
                    .setRequired(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('config')
                .setDescription('Configure D&D game settings')
                .addChannelOption(option => option
                    .setName('channel')
                    .setDescription('Channel to use for D&D game')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(false))
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
                const games = await context.tables.DndGame.findAll({
                    where: { guildId },
                    limit: 25,
                    order: [['updatedAt', 'DESC']],
                });

                const filtered = (games as unknown as DndGameAttributes[])
                    .filter((game: DndGameAttributes) =>
                        game.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
                    )
                    .slice(0, 25);

                await interaction.respond(
                    filtered.map((game: DndGameAttributes) => ({
                        name: `${game.name}${game.isActive ? ' (active)' : ''}`,
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
                case 'list':
                    await handleListGames(interaction, context);
                    break;
                case 'switch':
                    await handleSwitchGame(interaction, context);
                    break;
                case 'delete':
                    await handleDeleteGame(interaction, context);
                    break;
                case 'start':
                    await handleStartGame(interaction, context);
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
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const name = interaction.options.getString('name', true);
    const customPrompt = interaction.options.getString('prompt');

    try {
        // Check if game with this name already exists
        const existingGame = await context.tables.DndGame.findOne({
            where: { guildId, name },
        }) as unknown as DndGameAttributes | null;

        if (existingGame) {
            await interaction.reply({ content: `A game named "${name}" already exists.`, ephemeral: true });
            return;
        }

        // Create new game
        const systemPrompt = customPrompt || DEFAULT_SYSTEM_PROMPT;
        await context.tables.DndGame.create({
            guildId,
            name,
            systemPrompt,
            conversationHistory: [],
            isActive: false,
            waitPeriodMinutes: 5,
            currentRound: 0,
            pendingMessages: [],
        } as any);

        await interaction.reply({
            content: `✅ Created D&D game: **${name}**\nUse \`/dnd switch name:${name}\` to activate it.`,
            ephemeral: true,
        });
    } catch (error) {
        context.log.error({ error, guildId, name }, 'Failed to create D&D game');
        await interaction.reply({ content: 'Failed to create game. Please try again.', ephemeral: true });
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
            order: [['isActive', 'DESC'], ['updatedAt', 'DESC']],
        }) as unknown as DndGameAttributes[];

        if (games.length === 0) {
            await interaction.reply({ content: 'No D&D games found. Use `/dnd create` to create one.', ephemeral: true });
            return;
        }

        const gameList = games
            .map((game, index) => {
                const active = game.isActive ? '🎮 **ACTIVE**' : '';
                const channel = game.channelId ? ` - <#${game.channelId}>` : '';
                const rounds = game.currentRound > 0 ? ` (${game.currentRound} rounds)` : '';
                return `${index + 1}. **${game.name}** ${active}${channel}${rounds}`;
            })
            .join('\n');

        const embed = {
            title: '🎲 D&D Games',
            description: gameList,
            color: 0xFF6B6B,
            footer: {
                text: `Total: ${games.length} games`,
            },
        };

        await interaction.reply({ embeds: [embed], ephemeral: true });
    } catch (error) {
        context.log.error({ error, guildId }, 'Error listing D&D games');
        await interaction.reply({ content: 'Failed to list games.', ephemeral: true });
    }
}

async function handleSwitchGame(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const name = interaction.options.getString('name', true);

    try {
        // Find the game to switch to
        const game = await context.tables.DndGame.findOne({
            where: { guildId, name },
        }) as unknown as DndGameAttributes | null;

        if (!game) {
            await interaction.reply({ content: `Game "${name}" not found.`, ephemeral: true });
            return;
        }

        // Deactivate all other games
        await context.tables.DndGame.update(
            { isActive: false },
            { where: { guildId } },
        );

        // Activate this game
        await context.tables.DndGame.update(
            { isActive: true },
            { where: { guildId, name } },
        );

        await interaction.reply({
            content: `✅ Switched to game: **${name}**${game.channelId ? `\nListening in <#${game.channelId}>` : '\nUse `/dnd config` to set a channel.'}`,
            ephemeral: true,
        });
    } catch (error) {
        context.log.error({ error, guildId, name }, 'Failed to switch D&D game');
        await interaction.reply({ content: 'Failed to switch game. Please try again.', ephemeral: true });
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
        const deleted = await context.tables.DndGame.destroy({
            where: { guildId, name },
        });

        if (deleted === 0) {
            await interaction.reply({ content: `Game "${name}" not found.`, ephemeral: true });
            return;
        }

        await interaction.reply({
            content: `🗑️ Deleted game: **${name}**`,
            ephemeral: true,
        });
    } catch (error) {
        context.log.error({ error, guildId, name }, 'Failed to delete D&D game');
        await interaction.reply({ content: 'Failed to delete game. Please try again.', ephemeral: true });
    }
}

async function handleStartGame(interaction: ChatInputCommandInteraction, context: Context) {
    await interaction.deferReply();

    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.editReply('This command can only be used in a server.');
        return;
    }

    const prompt = interaction.options.getString('prompt', true);

    try {
        // Find active game
        const game = await context.tables.DndGame.findOne({
            where: { guildId, isActive: true },
        }) as unknown as DndGameAttributes | null;

        if (!game) {
            await interaction.editReply('No active game. Use `/dnd switch` to activate a game.');
            return;
        }

        if (!game.channelId) {
            await interaction.editReply('No channel configured. Use `/dnd config channel:#channel` to set one.');
            return;
        }

        // Generate initial response using OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });

        const messages = [
            { role: 'system' as const, content: game.systemPrompt },
            { role: 'user' as const, content: prompt },
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages,
            max_tokens: 300,
            temperature: 0.8,
        });

        const response = completion.choices[0].message.content;

        if (!response) {
            await interaction.editReply('Failed to generate opening scene.');
            return;
        }

        // Update conversation history
        const updatedHistory = [
            ...messages,
            { role: 'assistant' as const, content: response },
        ];

        await context.tables.DndGame.update(
            {
                conversationHistory: updatedHistory as any,
                currentRound: 1,
                pendingMessages: [] as any,
                lastResponseTime: new Date(),
            },
            { where: { guildId, isActive: true } },
        );

        // Send response to configured channel
        const channel = await interaction.client.channels.fetch(game.channelId);
        if (channel && channel.isTextBased()) {
            await channel.send(`🎲 **Game Started: ${game.name}**\n\n${response}`);
        }

        await interaction.editReply(`✅ Game started! Opening scene sent to <#${game.channelId}>`);
    } catch (error) {
        context.log.error({ error, guildId }, 'Failed to start D&D game');
        await interaction.editReply('Failed to start game. Please check your OpenAI API key and try again.');
    }
}

async function handleConfig(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;
    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const channel = interaction.options.getChannel('channel');
    const waitPeriod = interaction.options.getInteger('wait-period');

    try {
        // Find active game
        const game = await context.tables.DndGame.findOne({
            where: { guildId, isActive: true },
        }) as unknown as DndGameAttributes | null;

        if (!game) {
            await interaction.reply({
                content: 'No active game. Use `/dnd switch` to activate a game first.',
                ephemeral: true,
            });
            return;
        }

        const updates: any = {};
        if (channel) {
            updates.channelId = channel.id;
        }
        if (waitPeriod !== null) {
            updates.waitPeriodMinutes = waitPeriod;
        }

        if (Object.keys(updates).length === 0) {
            await interaction.reply({
                content: 'Please specify at least one option to configure.',
                ephemeral: true,
            });
            return;
        }

        await context.tables.DndGame.update(
            updates,
            { where: { guildId, isActive: true } },
        );

        const configMessage = [];
        if (channel) {
            configMessage.push(`Channel: <#${channel.id}>`);
        }
        if (waitPeriod !== null) {
            configMessage.push(`Wait period: ${waitPeriod} minutes`);
        }

        await interaction.reply({
            content: `✅ Updated configuration for **${game.name}**:\n${configMessage.join('\n')}`,
            ephemeral: true,
        });
    } catch (error) {
        context.log.error({ error, guildId }, 'Failed to configure D&D game');
        await interaction.reply({ content: 'Failed to update configuration.', ephemeral: true });
    }
}

export default dndCommand;
