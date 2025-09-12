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
            findOne: jest.fn(),
            create: jest.fn(),
        };

        mockBetBalances = {
            findOne: jest.fn(),
            create: jest.fn(),
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
            memberPermissions: {
                has: jest.fn().mockReturnValue(false),
            },
            reply: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getUser: jest.fn(),
                getInteger: jest.fn(),
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
            expect(balanceCommand.data.description).toContain('Check Sparks balance');
        });

        it('should have subcommands', () => {
            const commandData = balanceCommand.data.toJSON();
            const subcommands = commandData.options?.filter(opt => opt.type === 1) || [];
            const subcommandNames = subcommands.map(sub => sub.name);
            expect(subcommandNames).toContain('check');
            expect(subcommandNames).toContain('history');
        });
    });

    describe('balance check subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('check');
            mockInteraction.options.getUser.mockReturnValue(null); // No user specified
        });

        it('should show user balance with existing user', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };
            const mockBalance = {
                available_balance: 85,
                escrowed_balance: 25,
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetBalances.findOne.mockResolvedValue(mockBalance);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('testuser\'s Sparks Balance'),
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: 'Available',
                                        value: '85 Sparks',
                                    }),
                                    expect.objectContaining({
                                        name: 'In Escrow',
                                        value: '25 Sparks',
                                    }),
                                    expect.objectContaining({
                                        name: 'Total',
                                        value: '110 Sparks',
                                    }),
                                ]),
                            }),
                        }),
                    ]),
                    ephemeral: false,
                }),
            );
        });

        it('should create new user with starting balance', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };
            const mockBalance = {
                available_balance: 100,
                escrowed_balance: 0,
            };

            mockBetUsers.findOne.mockResolvedValue(null); // User doesn't exist
            mockBetUsers.create.mockResolvedValue(mockUser);
            mockBetBalances.create.mockResolvedValue(mockBalance);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockBetUsers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    discord_id: 'test-user-id',
                    handle: null,
                    hide_last_seen: false,
                }),
            );
            expect(mockBetBalances.create).toHaveBeenCalled();
        });

        it('should handle database errors gracefully', async () => {
            mockBetUsers.findOne.mockRejectedValue(new Error('Database error'));

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Database error'),
                    ephemeral: true,
                }),
            );
            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });

    describe('other user balance check (moderator)', () => {
        beforeEach(() => {
            const targetUser = { id: 'target-user-id', username: 'targetuser' };
            mockInteraction.options.getSubcommand.mockReturnValue('check');
            mockInteraction.options.getUser.mockReturnValue(targetUser);
            mockInteraction.memberPermissions.has.mockReturnValue(true); // Mock moderator
        });

        it('should show other user balance for moderators', async () => {
            const mockUser = { id: 2, discord_id: 'target-user-id' };
            const mockBalance = {
                available_balance: 50,
                escrowed_balance: 10,
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetBalances.findOne.mockResolvedValue(mockBalance);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('targetuser\'s Sparks Balance'),
                            }),
                        }),
                    ]),
                    ephemeral: true,
                }),
            );
        });

        it('should deny access to non-moderators', async () => {
            mockInteraction.memberPermissions.has.mockReturnValue(false);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Manage Messages permission'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle user not found', async () => {
            mockBetUsers.findOne.mockResolvedValue(null);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not registered in the betting system'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('transaction history subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('history');
            mockInteraction.options.getUser.mockReturnValue(null); // No user specified
            mockInteraction.options.getInteger.mockReturnValue(10);
        });

        it('should show transaction history', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };
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
            ];

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetLedger.findAll.mockResolvedValue(mockTransactions);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('testuser\'s Transaction History'),
                            }),
                        }),
                    ]),
                    ephemeral: true,
                }),
            );
        });

        it('should handle no transactions found', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetLedger.findAll.mockResolvedValue([]);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No transaction history found'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle user not found for history', async () => {
            mockBetUsers.findOne.mockResolvedValue(null);

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('not registered in the betting system'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('invalid subcommand', () => {
        it('should handle invalid subcommand', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('invalid');

            await balanceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'Invalid subcommand.',
                    ephemeral: true,
                }),
            );
        });
    });
});