import { SlashCommandBuilder } from 'discord.js';
import balanceCommand from './balance';
import { Context } from '../utils/types';

describe('balance command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockBetUsers: any;
    let mockBetBalances: any;
    let mockBetLedger: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockBetUsers = {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
        };

        mockBetBalances = {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
        };

        mockBetLedger = {
            findAll: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'test-user-id', username: 'testuser' },
            guild: { id: 'test-guild-id' },
            member: {
                permissions: { has: jest.fn().mockReturnValue(false) },
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
                BetBalances: mockBetBalances,
                BetLedger: mockBetLedger,
            },
        } as any;
    });

    describe('command data', () => {
        it('should have correct command name and description', () => {
            expect(balanceCommand.data).toBeInstanceOf(SlashCommandBuilder);
            expect(balanceCommand.data.name).toBe('balance');
            expect(balanceCommand.data.description).toContain('Check Spark balance');
        });

        it('should have optional user parameter', () => {
            const commandData = balanceCommand.data.toJSON();
            const userOption = commandData.options?.find(opt => opt.name === 'user');
            expect(userOption).toBeDefined();
            expect(userOption?.required).toBe(false);
        });
    });

    describe('personal balance check', () => {
        beforeEach(() => {
            mockInteraction.options.getUser.mockReturnValue(null); // No user specified
        });

        it('should show user balance with transaction history', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };
            const mockBalance = {
                current_balance: 85,
                escrow_balance: 25,
                lifetime_earned: 150,
                lifetime_spent: 40,
            };
            const mockTransactions = [
                {
                    type: 'earn',
                    amount: 5,
                    created_at: new Date(),
                    ref_type: 'message',
                },
                {
                    type: 'escrow_in',
                    amount: 25,
                    created_at: new Date(),
                    ref_type: 'bet',
                    ref_id: 'bet-uuid',
                },
            ];

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser]);
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance]);
            mockBetLedger.findAll.mockResolvedValue(mockTransactions);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('Your Spark Balance'),
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: 'Available',
                                        value: '85 ✨',
                                    }),
                                    expect.objectContaining({
                                        name: 'In Escrow',
                                        value: '25 ✨',
                                    }),
                                    expect.objectContaining({
                                        name: 'Lifetime Earned',
                                        value: '150 ✨',
                                    }),
                                    expect.objectContaining({
                                        name: 'Lifetime Spent',
                                        value: '40 ✨',
                                    }),
                                ]),
                            }),
                        }),
                    ]),
                    ephemeral: true,
                }),
            );
        });

        it('should create new user with starting balance', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };
            const mockBalance = {
                current_balance: 100,
                escrow_balance: 0,
                lifetime_earned: 100,
                lifetime_spent: 0,
            };

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser, true]); // true = was created
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance, true]);
            mockBetLedger.findAll.mockResolvedValue([]);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockBetUsers.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { discord_id: 'test-user-id' },
                    defaults: expect.objectContaining({
                        handle: 'testuser',
                    }),
                }),
            );
            expect(mockBetBalances.findOrCreate).toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            mockBetUsers.findOrCreate.mockRejectedValue(new Error('Database error'));

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error retrieving'),
                    ephemeral: true,
                }),
            );
            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });

    describe('other user balance check (moderator)', () => {
        beforeEach(() => {
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getUser.mockReturnValue(targetUser);
            mockInteraction.member.permissions.has.mockReturnValue(true); // Mock moderator
        });

        it('should show other user balance for moderators', async () => {
            const mockUser = { id: 2, discord_id: 'target-user-id' };
            const mockBalance = {
                current_balance: 50,
                escrow_balance: 10,
                lifetime_earned: 80,
                lifetime_spent: 20,
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetBalances.findOne.mockResolvedValue(mockBalance);
            mockBetLedger.findAll.mockResolvedValue([]);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('targetuser'),
                            }),
                        }),
                    ]),
                    ephemeral: true,
                }),
            );
        });

        it('should deny access to non-moderators', async () => {
            mockInteraction.member.permissions.has.mockReturnValue(false);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('permission'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle user not found', async () => {
            mockBetUsers.findOne.mockResolvedValue(null);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not found'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('transaction history formatting', () => {
        it('should format different transaction types correctly', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };
            const mockBalance = { current_balance: 100, escrow_balance: 0, lifetime_earned: 100, lifetime_spent: 0 };
            const mockTransactions = [
                {
                    type: 'earn',
                    amount: 1,
                    created_at: new Date('2025-09-11T10:00:00Z'),
                    ref_type: 'message',
                },
                {
                    type: 'payout',
                    amount: 50,
                    created_at: new Date('2025-09-11T09:00:00Z'),
                    ref_type: 'bet',
                    ref_id: 'bet-123',
                },
                {
                    type: 'escrow_in',
                    amount: 25,
                    created_at: new Date('2025-09-11T08:00:00Z'),
                    ref_type: 'bet',
                    ref_id: 'bet-456',
                },
            ];

            mockBetUsers.findOrCreate.mockResolvedValue([mockUser]);
            mockBetBalances.findOrCreate.mockResolvedValue([mockBalance]);
            mockBetLedger.findAll.mockResolvedValue(mockTransactions);

            await balanceCommand.execute(mockInteraction, mockContext);

            const embedCall = mockInteraction.reply.mock.calls[0][0];
            const embed = embedCall.embeds[0];
            const historyField = embed.data.fields.find((f: any) => f.name === 'Recent Transactions');

            expect(historyField).toBeDefined();
            expect(historyField.value).toContain('+1 ✨ (Message)');
            expect(historyField.value).toContain('+50 ✨ (Bet Win)');
            expect(historyField.value).toContain('-25 ✨ (Bet Escrow)');
        });
    });
});