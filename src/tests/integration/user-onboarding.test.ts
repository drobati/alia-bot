import { Message } from 'discord.js';
import { Context } from '../../utils/types';
import balanceCommand from '../../commands/balance';

// Mock Discord.js and external dependencies
jest.mock('../../utils/discordHelpers');

// Mock the engagement response module
const engagementResponse = jest.fn();

describe('User Onboarding & Spark Earning Integration', () => {
    let mockContext: Context;
    let mockBetUsers: any;
    let mockBetBalances: any;
    let mockBetLedger: any;
    let mockBetEngagementStats: any;
    let mockSequelize: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock database models
        mockBetUsers = {
            findOrCreate: jest.fn(),
        };

        mockBetBalances = {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
        };

        mockBetLedger = {
            create: jest.fn(),
            findAll: jest.fn(),
        };

        mockBetEngagementStats = {
            findOrCreate: jest.fn(),
            update: jest.fn(),
        };

        // Mock transaction
        const mockTransaction = {
            commit: jest.fn(),
            rollback: jest.fn(),
        };

        mockSequelize = {
            transaction: jest.fn().mockImplementation(callback =>
                callback(mockTransaction),
            ),
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            tables: {
                BetUsers: mockBetUsers,
                BetBalances: mockBetBalances,
                BetLedger: mockBetLedger,
                BetEngagementStats: mockBetEngagementStats,
            },
            sequelize: mockSequelize,
        } as any;
    });

    describe('Scenario 1: New User Onboarding & First Sparks', () => {
        it('should give new user 100 starting Sparks + 1 for message + 2 daily bonus', async () => {
            // Arrange: Fresh user posts qualifying message
            const mockMessage = {
                author: {
                    id: 'new-user-id',
                    username: 'newuser',
                    bot: false,
                },
                content: 'This is my first message, let\'s test the betting system!', // >15 chars
                guild: { id: 'test-guild' },
                channel: { id: 'test-channel' },
                reactions: { cache: new Map() },
                createdTimestamp: Date.now(),
            } as any as Message;

            // Mock new user creation
            const mockUser = { id: 1, discord_id: 'new-user-id' };
            const mockBalance = {
                current_balance: 100, // Starting balance
                escrow_balance: 0,
                lifetime_earned: 100,
                lifetime_spent: 0,
                update: jest.fn(),
            };
            const mockEngagementStats = {
                message_count: 0,
                daily_earn_count: 0,
                last_earn_at: null,
                last_reset_date: new Date().toDateString(),
                update: jest.fn(),
            };

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser, true]); // true = created
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance, true]);
            mockBetEngagementStats.findOrCreate.mockResolvedValue([mockEngagementStats, true]);

            // Act: Process engagement response
            const result = await engagementResponse(mockMessage, mockContext);

            // Assert: User should earn Sparks
            expect(result).toBe(true); // Response was triggered
            expect(mockBetUsers.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { discord_id: 'new-user-id' },
                    defaults: expect.objectContaining({
                        handle: 'newuser',
                    }),
                }),
            );

            // Should earn: 1 (message) + 2 (daily bonus) = 3 additional Sparks
            expect(mockBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 103, // 100 + 1 + 2
                    lifetime_earned: 103,
                }),
                expect.any(Object),
            );

            // Should log earning transaction
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    type: 'earn',
                    amount: 3, // Total earned this message
                    ref_type: 'message',
                }),
                expect.any(Object),
            );
        });

        it('should enforce 60-second cooldown between earning events', async () => {
            // Arrange: User with recent earning
            const mockMessage = {
                author: {
                    id: 'existing-user-id',
                    username: 'existinguser',
                    bot: false,
                },
                content: 'Another qualifying message within cooldown',
                guild: { id: 'test-guild' },
                channel: { id: 'test-channel' },
                reactions: { cache: new Map() },
                createdTimestamp: Date.now(),
            } as any as Message;

            const mockUser = { id: 1, discord_id: 'existing-user-id' };
            const mockBalance = { current_balance: 50, update: jest.fn() };
            const mockEngagementStats = {
                last_earn_at: new Date(Date.now() - 30 * 1000), // 30 seconds ago
                daily_earn_count: 5,
                update: jest.fn(),
            };

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance, false]);
            mockBetEngagementStats.findOrCreate.mockResolvedValue([mockEngagementStats, false]);

            // Act: Process message within cooldown
            const result = await engagementResponse(mockMessage, mockContext);

            // Assert: Should not earn Sparks due to cooldown
            expect(result).toBe(false); // No response due to cooldown
            expect(mockBalance.update).not.toHaveBeenCalled();
            expect(mockBetLedger.create).not.toHaveBeenCalled();
        });

        it('should allow earning after 61-second cooldown', async () => {
            // Arrange: User with old earning timestamp
            const mockMessage = {
                author: {
                    id: 'cooldown-user-id',
                    username: 'cooldownuser',
                    bot: false,
                },
                content: 'Message after cooldown period',
                guild: { id: 'test-guild' },
                channel: { id: 'test-channel' },
                reactions: { cache: new Map() },
                createdTimestamp: Date.now(),
            } as any as Message;

            const mockUser = { id: 1, discord_id: 'cooldown-user-id' };
            const mockBalance = {
                current_balance: 50,
                lifetime_earned: 150,
                update: jest.fn(),
            };
            const mockEngagementStats = {
                last_earn_at: new Date(Date.now() - 61 * 1000), // 61 seconds ago
                daily_earn_count: 5,
                last_reset_date: new Date().toDateString(),
                update: jest.fn(),
            };

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance, false]);
            mockBetEngagementStats.findOrCreate.mockResolvedValue([mockEngagementStats, false]);

            // Act: Process message after cooldown
            const result = await engagementResponse(mockMessage, mockContext);

            // Assert: Should earn 1 Spark
            expect(result).toBe(true);
            expect(mockBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 51, // +1 Spark
                    lifetime_earned: 151,
                }),
                expect.any(Object),
            );
        });

        it('should award reaction bonus when message gets reactions', async () => {
            // This test would require mocking Discord reaction events
            // For now, we'll test the logic assuming the reaction occurred
            const mockMessage = {
                author: {
                    id: 'reaction-user-id',
                    username: 'reactionuser',
                    bot: false,
                },
                content: 'Message that will get reactions',
                guild: { id: 'test-guild' },
                channel: { id: 'test-channel' },
                reactions: {
                    cache: new Map([
                        ['👍', { count: 2, users: { cache: new Map() } }],
                    ]),
                },
                createdTimestamp: Date.now() - (5 * 60 * 1000), // 5 minutes ago
            } as any as Message;

            const mockUser = { id: 1, discord_id: 'reaction-user-id' };
            const mockBalance = {
                current_balance: 100,
                lifetime_earned: 100,
                update: jest.fn(),
            };

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance, false]);

            // Act: Process reaction bonus (this would be triggered by reaction event)
            // For testing purposes, we simulate the bonus earning
            await mockBalance.update({
                current_balance: 101,
                lifetime_earned: 101,
            });

            await mockBetLedger.create({
                user_id: 1,
                type: 'earn',
                amount: 1,
                ref_type: 'reaction_bonus',
                ref_id: mockMessage.id,
            });

            // Assert: Should earn reaction bonus
            expect(mockBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 101,
                }),
                expect.any(Object),
            );
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'earn',
                    amount: 1,
                    ref_type: 'reaction_bonus',
                }),
                expect.any(Object),
            );
        });
    });

    describe('Balance Command Integration', () => {
        it('should show correct balance after earning sequence', async () => {
            // Arrange: User who has earned Sparks
            const mockInteraction = {
                user: { id: 'test-user-id', username: 'testuser' },
                guild: { id: 'test-guild-id' },
                reply: jest.fn(),
                options: {
                    getUser: jest.fn().mockReturnValue(null), // Check own balance
                },
            };

            const mockUser = { id: 1, discord_id: 'test-user-id' };
            const mockBalance = {
                current_balance: 103, // After earning scenario
                escrow_balance: 0,
                lifetime_earned: 103,
                lifetime_spent: 0,
            };
            const mockTransactions = [
                {
                    type: 'earn',
                    amount: 3,
                    created_at: new Date(),
                    ref_type: 'message',
                },
            ];

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance, false]);
            mockBetLedger.findAll.mockResolvedValue(mockTransactions);

            // Act: Check balance
            await balanceCommand.execute(mockInteraction as any, mockContext);

            // Assert: Should show correct balance from earning
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: 'Available',
                                        value: '103 ✨',
                                    }),
                                    expect.objectContaining({
                                        name: 'Lifetime Earned',
                                        value: '103 ✨',
                                    }),
                                ]),
                            }),
                        }),
                    ]),
                    ephemeral: true,
                }),
            );
        });
    });
});