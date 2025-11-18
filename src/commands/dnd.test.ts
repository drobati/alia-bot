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
            channelId: 'test-channel-id',
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
            replied: false,
            deferred: false,
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

        it('should defer reply and check for active games', async () => {
            mockDndGameModel.findOne.mockResolvedValue(null);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
            // Check for active game in channel
            expect(mockDndGameModel.findOne).toHaveBeenCalledWith({
                where: { guildId: 'test-guild-id', channelId: 'test-channel-id', isActive: true },
            });
        });


        it('should reject if channel already has active game', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'existing-game',
                channelId: 'test-channel-id',
                isActive: true,
            });

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.create).not.toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                expect.stringContaining('This channel already has an active game')
            );
        });

        it('should handle database errors gracefully', async () => {
            mockDndGameModel.findOne.mockRejectedValue(new Error('Database error'));

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
        });

        it('should reject if not in a guild', async () => {
            mockInteraction.guildId = null;

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.findOne).not.toHaveBeenCalled();
            expect(mockInteraction.editReply).toHaveBeenCalledWith(
                'This command can only be used in a server.'
            );
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
                order: [['channelId', 'DESC'], ['updatedAt', 'DESC']],
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

    describe('delete subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('delete');
            mockInteraction.options.getString.mockReturnValue('game-to-delete');
        });

        it('should check if game exists before deleting', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'game-to-delete',
                channelId: null, // saved game
            });
            mockDndGameModel.destroy.mockResolvedValue(1);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.findOne).toHaveBeenCalledWith({
                where: { guildId: 'test-guild-id', name: 'game-to-delete' },
            });
        });

        it('should reject deleting active game', async () => {
            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'game-to-delete',
                channelId: 'some-channel',
            });

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.destroy).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('currently active'),
                ephemeral: true,
            });
        });
    });

    describe('config subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('config');
        });

        it('should update wait period for game in channel', async () => {
            mockInteraction.options.getInteger.mockReturnValue(15);

            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                channelId: 'test-channel-id',
            });
            mockDndGameModel.update.mockResolvedValue([1]);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                { waitPeriodMinutes: 15 },
                { where: { guildId: 'test-guild-id', channelId: 'test-channel-id' } },
            );
        });

        it('should reject if no active game in channel', async () => {
            mockInteraction.options.getInteger.mockReturnValue(10);
            mockDndGameModel.findOne.mockResolvedValue(null);

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'No active game in this channel.',
                ephemeral: true,
            });
        });

        it('should reject if wait-period not provided', async () => {
            mockInteraction.options.getInteger.mockReturnValue(null);

            mockDndGameModel.findOne.mockResolvedValue({
                id: 1,
                name: 'test-game',
                channelId: 'test-channel-id',
            });

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockDndGameModel.update).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please specify the wait-period option.',
                ephemeral: true,
            });
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

        it('should log errors from subcommands', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('create');
            mockInteraction.options.getString.mockReturnValue('test-game');
            mockDndGameModel.findOne.mockRejectedValue(new Error('Database error'));

            await dndCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });
});
