import dndCommand from './dnd';
import { DndGameAttributes } from '../types/database';
import OpenAI from 'openai';

// Mock OpenAI
jest.mock('openai');

describe('DnD Command', () => {
    let mockInteraction: any;
    let mockContext: any;
    let mockDndGameModel: any;
    let mockClient: any;
    let mockChannel: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock channel
        mockChannel = {
            id: 'test-channel-id',
            send: jest.fn().mockResolvedValue(undefined),
            isTextBased: jest.fn().mockReturnValue(true),
        };

        // Mock client
        mockClient = {
            channels: {
                fetch: jest.fn().mockResolvedValue(mockChannel),
            },
        };

        // Mock DndGame model
        mockDndGameModel = {
            findOne: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
            destroy: jest.fn(),
        };

        // Mock interaction
        mockInteraction = {
            guildId: 'test-guild-id',
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getChannel: jest.fn(),
                getInteger: jest.fn(),
                getFocused: jest.fn(),
            },
            reply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
            deferReply: jest.fn().mockResolvedValue(undefined),
            respond: jest.fn().mockResolvedValue(undefined),
            followUp: jest.fn().mockResolvedValue(undefined),
            client: mockClient,
        };

        // Mock context
        mockContext = {
            tables: {
                DndGame: mockDndGameModel,
            },
            log: {
                info: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            sequelize: {},
            client: mockClient,
        };
    });

    describe('create subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('create');
            mockInteraction.options.getString.mockImplementation((name: string) => {
                if (name === 'name') {
                    return 'test-game';
                }
                if (name === 'prompt') {
                    return null;
                }
                return null;
            });
        });

        it('should create a new game with default prompt', async () => {
            mockDndGameModel.findOne.mockResolvedValue(null);
            mockDndGameModel.create.mockResolvedValue({
                id: 1,
                guildId: 'test-guild-id',
                name: 'test-game',
                systemPrompt: expect.any(String),
                isActive: false,
            });

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.findOne).toHaveBeenCalledWith({
                where: { guildId: 'test-guild-id', name: 'test-game' },
            });
            expect(mockDndGameModel.create).toHaveBeenCalledWith({
                guildId: 'test-guild-id',
                name: 'test-game',
                systemPrompt: expect.stringContaining('MUD-like D&D campaign'),
                conversationHistory: [],
                isActive: false,
                waitPeriodMinutes: 5,
                currentRound: 0,
                pendingMessages: [],
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Created D&D game: **test-game**'),
                ephemeral: true,
            });
        });

        it('should create a new game with custom prompt', async () => {
            mockInteraction.options.getString.mockImplementation((name: string) => {
                if (name === 'name') {
                    return 'test-game';
                }
                if (name === 'prompt') {
                    return 'Custom system prompt';
                }
                return null;
            });
            mockDndGameModel.findOne.mockResolvedValue(null);
            mockDndGameModel.create.mockResolvedValue({});

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.create).toHaveBeenCalledWith({
                guildId: 'test-guild-id',
                name: 'test-game',
                systemPrompt: 'Custom system prompt',
                conversationHistory: [],
                isActive: false,
                waitPeriodMinutes: 5,
                currentRound: 0,
                pendingMessages: [],
            });
        });

        it('should reject duplicate game names', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
            });

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.create).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'A game named "test-game" already exists.',
                ephemeral: true,
            });
        });

        it('should handle errors gracefully', async () => {
            mockDndGameModel.findOne.mockRejectedValue(new Error('Database error'));

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Failed to create game. Please try again.',
                ephemeral: true,
            });
        });

        it('should reject if not in a guild', async () => {
            mockInteraction.guildId = null;

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.findOne).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        });
    });

    describe('list subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('list');
        });

        it('should list all games', async () => {
            const mockGames: Partial<DndGameAttributes>[] = [
                {
                    id: 1,
                    name: 'active-game',
                    isActive: true,
                    channelId: 'channel-1',
                    currentRound: 5,
                },
                {
                    id: 2,
                    name: 'inactive-game',
                    isActive: false,
                    currentRound: 0,
                },
            ];
            mockDndGameModel.findAll.mockResolvedValue(mockGames);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.findAll).toHaveBeenCalledWith({
                where: { guildId: 'test-guild-id' },
                order: [['isActive', 'DESC'], ['updatedAt', 'DESC']],
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: [
                    expect.objectContaining({
                        title: '🎲 D&D Games',
                        description: expect.stringContaining('active-game'),
                    }),
                ],
                ephemeral: true,
            });
        });

        it('should show empty state when no games exist', async () => {
            mockDndGameModel.findAll.mockResolvedValue([]);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'No D&D games found. Use `/dnd create` to create one.',
                ephemeral: true,
            });
        });

        it('should handle errors', async () => {
            mockDndGameModel.findAll.mockRejectedValue(new Error('Database error'));

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Failed to list games.',
                ephemeral: true,
            });
        });
    });

    describe('switch subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('switch');
            mockInteraction.options.getString.mockReturnValue('target-game');
        });

        it('should switch to a different game', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'target-game',
                channelId: 'channel-1',
            });
            mockDndGameModel.update.mockResolvedValue([1]);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                { isActive: false },
                { where: { guildId: 'test-guild-id' } },
            );
            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                { isActive: true },
                { where: { guildId: 'test-guild-id', name: 'target-game' } },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Switched to game: **target-game**'),
                ephemeral: true,
            });
        });

        it('should handle non-existent game', async () => {
            mockDndGameModel.findOne.mockResolvedValue(null);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Game "target-game" not found.',
                ephemeral: true,
            });
        });

        it('should show channel prompt if no channel configured', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'target-game',
                channelId: null,
            });
            mockDndGameModel.update.mockResolvedValue([1]);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Use `/dnd config` to set a channel.'),
                ephemeral: true,
            });
        });
    });

    describe('delete subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('delete');
            mockInteraction.options.getString.mockReturnValue('game-to-delete');
        });

        it('should delete a game', async () => {
            mockDndGameModel.destroy.mockResolvedValue(1);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.destroy).toHaveBeenCalledWith({
                where: { guildId: 'test-guild-id', name: 'game-to-delete' },
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '🗑️ Deleted game: **game-to-delete**',
                ephemeral: true,
            });
        });

        it('should handle non-existent game', async () => {
            mockDndGameModel.destroy.mockResolvedValue(0);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Game "game-to-delete" not found.',
                ephemeral: true,
            });
        });
    });

    describe('start subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('start');
            mockInteraction.options.getString.mockReturnValue('A dark dungeon awaits...');
        });

        it('should start a game with opening scene', async () => {
            const mockGame: Partial<DndGameAttributes> = {
                id: 1,
                name: 'test-game',
                systemPrompt: 'You are a DM',
                channelId: 'channel-1',
                conversationHistory: [],
            };
            mockDndGameModel.findOne.mockResolvedValue(mockGame);
            mockDndGameModel.update.mockResolvedValue([1]);

            // Mock OpenAI
            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{
                                message: {
                                    content: 'You descend into darkness...',
                                },
                            }],
                        }),
                    },
                },
            } as any));

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    currentRound: 1,
                }),
                { where: { guildId: 'test-guild-id', isActive: true } },
            );
            expect(mockChannel.send).toHaveBeenCalledWith(
                expect.stringContaining('Game Started: test-game'),
            );
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('Game started!'),
            );
        });

        it('should reject if no active game', async () => {
            mockDndGameModel.findOne.mockResolvedValue(null);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'No active game. Use `/dnd switch` to activate a game.',
            );
        });

        it('should reject if no channel configured', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                channelId: null,
            });

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'No channel configured. Use `/dnd config channel:#channel` to set one.',
            );
        });

        it('should handle OpenAI errors', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                channelId: 'channel-1',
                systemPrompt: 'You are a DM',
            });

            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockRejectedValue(new Error('API Error')),
                    },
                },
            } as any));

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('Failed to start game'),
            );
        });
    });

    describe('config subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('config');
        });

        it('should update channel configuration', async () => {
            const mockChannel = { id: 'new-channel-id' };
            mockInteraction.options.getChannel.mockReturnValue(mockChannel);
            mockInteraction.options.getInteger.mockReturnValue(null);

            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                isActive: true,
            });
            mockDndGameModel.update.mockResolvedValue([1]);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                { channelId: 'new-channel-id' },
                { where: { guildId: 'test-guild-id', isActive: true } },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Channel: <#new-channel-id>'),
                ephemeral: true,
            });
        });

        it('should update wait period configuration', async () => {
            mockInteraction.options.getChannel.mockReturnValue(null);
            mockInteraction.options.getInteger.mockReturnValue(10);

            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                isActive: true,
            });
            mockDndGameModel.update.mockResolvedValue([1]);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                { waitPeriodMinutes: 10 },
                { where: { guildId: 'test-guild-id', isActive: true } },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Wait period: 10 minutes'),
                ephemeral: true,
            });
        });

        it('should update both channel and wait period', async () => {
            const mockChannel = { id: 'new-channel-id' };
            mockInteraction.options.getChannel.mockReturnValue(mockChannel);
            mockInteraction.options.getInteger.mockReturnValue(15);

            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                isActive: true,
            });
            mockDndGameModel.update.mockResolvedValue([1]);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                { channelId: 'new-channel-id', waitPeriodMinutes: 15 },
                { where: { guildId: 'test-guild-id', isActive: true } },
            );
        });

        it('should reject if no active game', async () => {
            mockInteraction.options.getChannel.mockReturnValue({ id: 'channel-id' });
            mockDndGameModel.findOne.mockResolvedValue(null);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'No active game. Use `/dnd switch` to activate a game first.',
                ephemeral: true,
            });
        });

        it('should reject if no options provided', async () => {
            mockInteraction.options.getChannel.mockReturnValue(null);
            mockInteraction.options.getInteger.mockReturnValue(null);

            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                isActive: true,
            });

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please specify at least one option to configure.',
                ephemeral: true,
            });
        });
    });

    describe('autocomplete', () => {
        it('should provide game name suggestions', async () => {
            const mockGames = [
                { name: 'dungeon-crawl', isActive: true },
                { name: 'dragon-quest', isActive: false },
                { name: 'dark-forest', isActive: false },
            ];
            mockDndGameModel.findAll.mockResolvedValue(mockGames);

            mockInteraction.options.getFocused.mockReturnValue({
                name: 'name',
                value: 'dun',
            });
            mockInteraction.guildId = 'test-guild-id';

            await dndCommand.autocomplete(mockInteraction, mockContext);

            expect(mockDndGameModel.findAll).toHaveBeenCalledWith({
                where: { guildId: 'test-guild-id' },
                limit: 25,
                order: [['updatedAt', 'DESC']],
            });
            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: 'dungeon-crawl (active)', value: 'dungeon-crawl' },
            ]);
        });

        it('should handle autocomplete errors', async () => {
            mockDndGameModel.findAll.mockRejectedValue(new Error('Database error'));
            mockInteraction.options.getFocused.mockReturnValue({ name: 'name', value: '' });

            await dndCommand.autocomplete(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.respond).toHaveBeenCalledWith([]);
        });
    });

    describe('error handling', () => {
        it('should handle unexpected subcommand', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('invalid');

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Unknown subcommand.',
                ephemeral: true,
            });
        });

        it('should handle errors after reply', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('create');
            mockInteraction.options.getString.mockReturnValue('test-game');
            mockInteraction.replied = true;
            mockDndGameModel.findOne.mockRejectedValue(new Error('Database error'));

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.followUp).toHaveBeenCalledWith({
                content: expect.stringContaining('Failed to create game'),
                ephemeral: true,
            });
        });
    });
});
