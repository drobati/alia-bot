import { SlashCommandBuilder } from 'discord.js';
import lastseenCommand from './lastseen';
import { Context } from '../utils/types';

describe('lastseen command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockBetUsers: any;
    let mockBetEngagementStats: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockBetUsers = {
            findOne: jest.fn(),
        };

        mockBetEngagementStats = {
            findOne: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'requester-id', username: 'requester' },
            guild: {
                id: 'test-guild-id',
                members: {
                    cache: {
                        get: jest.fn(),
                    },
                },
                channels: {
                    cache: {
                        get: jest.fn(),
                    },
                },
            },
            reply: jest.fn(),
            options: {
                getUser: jest.fn(),
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
            },
        } as any;
    });

    describe('command data', () => {
        it('should have correct command name and description', () => {
            expect(lastseenCommand.data).toBeInstanceOf(SlashCommandBuilder);
            expect(lastseenCommand.data.name).toBe('lastseen');
            expect(lastseenCommand.data.description).toContain('Check when a user was last seen');
        });

        it('should have required user parameter', () => {
            const commandData = lastseenCommand.data.toJSON();
            const userOption = commandData.options?.find(opt => opt.name === 'user');
            expect(userOption).toBeDefined();
            expect(userOption?.required).toBe(true);
        });
    });

    describe('successful last seen check', () => {
        beforeEach(() => {
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);

            const mockGuildMember = {
                user: targetUser,
                displayName: 'Target User',
            };
            mockInteraction.guild.members.cache.get.mockReturnValue(mockGuildMember);
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
            };

            const mockChannel = {
                name: 'general',
                toString: () => '<#channel-123>',
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetEngagementStats.findOne.mockResolvedValue(mockEngagementStats);
            mockInteraction.guild.channels.cache.get.mockReturnValue(mockChannel);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('Last Seen'),
                                description: expect.stringContaining('Target User'),
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: 'Last Active',
                                        value: expect.stringContaining('<#channel-123>'),
                                    }),
                                    expect.objectContaining({
                                        name: 'Time',
                                        value: expect.stringMatching(/.*ago.*/),
                                    }),
                                ]),
                            }),
                        }),
                    ]),
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
                    content: expect.stringContaining('privacy settings'),
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
                    content: expect.stringContaining('never been active'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('error handling', () => {
        beforeEach(() => {
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);
        });

        it('should handle user not in betting system', async () => {
            mockBetUsers.findOne.mockResolvedValue(null);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not found'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle user not in guild', async () => {
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);
            mockInteraction.guild.members.cache.get.mockReturnValue(null);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not a member'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle database errors', async () => {
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);
            mockInteraction.guild.members.cache.get.mockReturnValue({ user: targetUser });
            mockBetUsers.findOne.mockRejectedValue(new Error('Database error'));

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true,
                }),
            );
            expect(mockContext.log.error).toHaveBeenCalled();
        });

        it('should prevent checking own last seen', async () => {
            const sameUser = { id: 'requester-id', username: 'requester' };
            mockInteraction.options.getUser.mockReturnValue(sameUser);

            await lastseenCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('check your own'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('time formatting', () => {
        beforeEach(() => {
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);
            mockInteraction.guild.members.cache.get.mockReturnValue({
                user: targetUser,
                displayName: 'Target User',
            });

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
            });
            mockInteraction.guild.channels.cache.get.mockReturnValue({
                name: 'general',
                toString: () => '<#channel-123>',
            });

            await lastseenCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.reply.mock.calls[0][0];
            const timeField = embedCall.embeds[0].data.fields.find((f: any) => f.name === 'Time');
            expect(timeField?.value).toMatch(/2 minutes ago/);
        });

        it('should format old times correctly', async () => {
            const threeDaysAgo = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000);
            mockBetEngagementStats.findOne.mockResolvedValue({
                last_message_at: threeDaysAgo,
                last_message_channel_id: 'channel-123',
            });
            mockInteraction.guild.channels.cache.get.mockReturnValue({
                name: 'general',
                toString: () => '<#channel-123>',
            });

            await lastseenCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.reply.mock.calls[0][0];
            const timeField = embedCall.embeds[0].data.fields.find((f: any) => f.name === 'Time');
            expect(timeField?.value).toMatch(/3 days ago/);
        });
    });
});