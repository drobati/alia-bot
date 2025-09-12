import { SlashCommandBuilder } from 'discord.js';
import lastseenCommand from './lastseen';
import { Context } from '../utils/types';

describe('lastseen command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockBetUsers: any;
    let mockBetEngagementStats: any;
    let mockBetBalances: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockBetUsers = {
            findOne: jest.fn(),
            create: jest.fn(),
            update: jest.fn(),
        };

        mockBetEngagementStats = {
            findOne: jest.fn(),
            create: jest.fn(),
        };

        mockBetBalances = {
            create: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'requester-id', username: 'requester' },
            guild: { id: 'test-guild-id' },
            reply: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getUser: jest.fn(),
                getBoolean: jest.fn(),
            },
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            tables: {
                BetUsers: mockBetUsers,
                BetEngagementStats: mockBetEngagementStats,
                BetBalances: mockBetBalances,
            },
        } as any;
    });

    describe('command data', () => {
        it('should have correct command name and description', () => {
            expect(lastseenCommand.data).toBeInstanceOf(SlashCommandBuilder);
            expect(lastseenCommand.data.name).toBe('lastseen');
            expect(lastseenCommand.data.description).toContain('Check when someone was last seen');
        });

        it('should have required subcommands', () => {
            const commandData = lastseenCommand.data.toJSON();
            const subcommands = commandData.options?.filter(opt => opt.type === 1) || [];
            const subcommandNames = subcommands.map(sub => sub.name);
            expect(subcommandNames).toContain('check');
            expect(subcommandNames).toContain('privacy');
        });
    });

    describe('check subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('check');
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);
        });

        it('should show last seen information when available', async () => {
            const lastMessageTime = new Date('2025-09-11T14:30:00Z');
            const mockUser = {
                id: 1,
                discord_id: 'target-user-id',
                hide_last_seen: false,
            };
            const mockEngagementStats = {
                last_message_at: lastMessageTime,
                last_message_channel_id: 'channel-123',
                message_count: 42,
                daily_earn_count: 5,
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetEngagementStats.findOne.mockResolvedValue(mockEngagementStats);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('Last Seen: targetuser'),
                                description: expect.stringContaining('<#channel-123>'),
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: 'Message Count',
                                        value: '42',
                                    }),
                                    expect.objectContaining({
                                        name: 'Daily Earns',
                                        value: '5',
                                    }),
                                ]),
                            }),
                        }),
                    ]),
                    ephemeral: true,
                }),
            );
        });

        it('should respect privacy settings', async () => {
            const mockUser = {
                id: 1,
                discord_id: 'target-user-id',
                hide_last_seen: true,
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('chosen to keep their last seen time private'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle user never seen', async () => {
            const mockUser = {
                id: 1,
                discord_id: 'target-user-id',
                hide_last_seen: false,
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetEngagementStats.findOne.mockResolvedValue(null);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No activity recorded'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle user not in betting system', async () => {
            mockBetUsers.findOne.mockResolvedValue(null);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not registered in the betting system'),
                    ephemeral: true,
                }),
            );
        });

        it('should prevent checking own last seen', async () => {
            const sameUser = { id: 'requester-id', username: 'requester' };
            mockInteraction.options.getUser.mockReturnValue(sameUser);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('You\'re... you\'re right here'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle database errors', async () => {
            mockBetUsers.findOne.mockRejectedValue(new Error('Database error'));

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Database error'),
                    ephemeral: true,
                }),
            );
            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });

    describe('privacy subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('privacy');
        });

        it('should create new user with privacy setting when user does not exist', async () => {
            mockInteraction.options.getBoolean.mockReturnValue(true); // Hide = true
            mockBetUsers.findOne.mockResolvedValue(null);

            const mockUser = { id: 1, discord_id: 'requester-id' };
            mockBetUsers.create.mockResolvedValue(mockUser);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockBetUsers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    discord_id: 'requester-id',
                    handle: null,
                    hide_last_seen: true,
                }),
            );

            expect(mockBetBalances.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    available_balance: 100,
                    escrowed_balance: 0,
                }),
            );

            expect(mockBetEngagementStats.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    message_count: 0,
                    daily_earn_count: 0,
                }),
            );

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Welcome to the betting system'),
                    ephemeral: true,
                }),
            );
        });

        it('should update existing user privacy setting', async () => {
            mockInteraction.options.getBoolean.mockReturnValue(false); // Hide = false

            const mockUser = {
                id: 1,
                discord_id: 'requester-id',
                hide_last_seen: true,
                update: jest.fn(),
            };
            mockBetUsers.findOne.mockResolvedValue(mockUser);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockUser.update).toHaveBeenCalledWith({ hide_last_seen: false });

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('👀 Your last seen status is now **visible**'),
                    ephemeral: true,
                }),
            );
        });

        it('should show correct message when hiding last seen', async () => {
            mockInteraction.options.getBoolean.mockReturnValue(true); // Hide = true

            const mockUser = {
                id: 1,
                discord_id: 'requester-id',
                hide_last_seen: false,
                update: jest.fn(),
            };
            mockBetUsers.findOne.mockResolvedValue(mockUser);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockUser.update).toHaveBeenCalledWith({ hide_last_seen: true });

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('🔒 Your last seen status is now **hidden**'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('time formatting', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('check');
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);

            const mockUser = {
                id: 1,
                discord_id: 'target-user-id',
                hide_last_seen: false,
            };
            mockBetUsers.findOne.mockResolvedValue(mockUser);
        });

        it('should format recent times correctly', async () => {
            const twoMinutesAgo = new Date(Date.now() - 2 * 60 * 1000);
            mockBetEngagementStats.findOne.mockResolvedValue({
                last_message_at: twoMinutesAgo,
                last_message_channel_id: 'channel-123',
                message_count: 10,
                daily_earn_count: 2,
            });

            await lastseenCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.reply.mock.calls[0][0];
            const description = embedCall.embeds[0].data.description;
            expect(description).toMatch(/2 minutes ago/);
        });

        it('should format old times correctly', async () => {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            mockBetEngagementStats.findOne.mockResolvedValue({
                last_message_at: threeDaysAgo,
                last_message_channel_id: 'channel-123',
                message_count: 50,
                daily_earn_count: 8,
            });

            await lastseenCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.reply.mock.calls[0][0];
            const description = embedCall.embeds[0].data.description;
            expect(description).toMatch(/3 days ago/);
        });

        it('should handle engagement stats without last_message_at', async () => {
            mockBetEngagementStats.findOne.mockResolvedValue({
                last_message_at: null,
                last_message_channel_id: null,
                message_count: 0,
                daily_earn_count: 0,
            });

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No activity recorded'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('invalid subcommand', () => {
        it('should handle invalid subcommand', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('invalid');

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'Invalid subcommand.',
                    ephemeral: true,
                }),
            );
        });
    });
});