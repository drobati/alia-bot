import betCommand from '../../commands/bet';
import { Context } from '../../utils/types';

describe('Bet Settlement & Payouts Integration', () => {
    let mockContext: Context;
    let mockBetUsers: any;
    let mockBetBalances: any;
    let mockBetWagers: any;
    let mockBetParticipants: any;
    let mockBetLedger: any;
    let mockSequelize: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockBetUsers = {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
        };

        mockBetBalances = {
            findOne: jest.fn(),
            update: jest.fn(),
        };

        mockBetWagers = {
            findByPk: jest.fn(),
            update: jest.fn(),
        };

        mockBetParticipants = {
            findAll: jest.fn(),
        };

        mockBetLedger = {
            create: jest.fn(),
            bulkCreate: jest.fn(),
        };

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
                BetWagers: mockBetWagers,
                BetParticipants: mockBetParticipants,
                BetLedger: mockBetLedger,
            },
            sequelize: mockSequelize,
        } as any;
    });

    describe('Scenario 3: Bet Settlement & Payouts', () => {
        it('should distribute winnings proportionally with 1:1 odds', async () => {
            // Arrange: Moderator settles bet with "for" outcome
            const moderatorInteraction = {
                user: { id: 'moderator-id', username: 'moderator' },
                guild: { id: 'test-guild-id' },
                member: {
                    permissions: { has: jest.fn().mockReturnValue(true) }, // Mock moderator perms
                },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('settle'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'bet-uuid';
                            case 'outcome': return 'for';
                            default: return null;
                        }
                    }),
                },
            };

            // Mock bet with participants: 40 "for", 20 "against"
            const bet = {
                id: 'bet-uuid',
                status: 'closed',
                total_for: 40, // User A: 25, User B: 15
                total_against: 20, // User C: 20
                odds_for: 1,
                odds_against: 1,
                update: jest.fn(),
            };

            const participants = [
                { user_id: 1, side: 'for', amount: 25 }, // User A
                { user_id: 2, side: 'for', amount: 15 }, // User B
                { user_id: 3, side: 'against', amount: 20 }, // User C (loser)
            ];

            // Mock user balances
            const userABalance = {
                current_balance: 75, // Had 25 in escrow
                escrow_balance: 25,
                update: jest.fn(),
            };
            const userBBalance = {
                current_balance: 35, // Had 15 in escrow
                escrow_balance: 15,
                update: jest.fn(),
            };
            const userCBalance = {
                current_balance: 60, // Had 20 in escrow
                escrow_balance: 20,
                update: jest.fn(),
            };

            mockBetWagers.findByPk.mockResolvedValue(bet);
            mockBetParticipants.findAll.mockResolvedValue(participants);
            mockBetBalances.findOne.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve(userABalance);
                    case 2: return Promise.resolve(userBBalance);
                    case 3: return Promise.resolve(userCBalance);
                    default: return Promise.resolve(null);
                }
            });

            // Act: Settle bet
            await betCommand.execute(moderatorInteraction as any, mockContext);

            // Assert: Bet marked as settled
            expect(bet.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'settled',
                    outcome: 'for',
                    settled_at: expect.any(Date),
                }),
                expect.any(Object),
            );

            // Assert: Winners receive proportional payouts
            // User A: Gets back 25 stake + (25/40 * 20 winnings) = 25 + 12.5 = 37.5 ≈ 37
            expect(userABalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 112, // 75 + 37
                    escrow_balance: 0,
                }),
                expect.any(Object),
            );

            // User B: Gets back 15 stake + (15/40 * 20 winnings) = 15 + 7.5 = 22.5 ≈ 23
            expect(userBBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 58, // 35 + 23
                    escrow_balance: 0,
                }),
                expect.any(Object),
            );

            // User C: Loses escrow, gets nothing back
            expect(userCBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 60, // No change to available balance
                    escrow_balance: 0, // Escrow cleared
                }),
                expect.any(Object),
            );

            // Assert: Ledger entries created for payouts
            expect(mockBetLedger.bulkCreate).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        user_id: 1,
                        type: 'escrow_out',
                        amount: 25,
                    }),
                    expect.objectContaining({
                        user_id: 1,
                        type: 'payout',
                        amount: 12, // Rounded winnings
                    }),
                    expect.objectContaining({
                        user_id: 2,
                        type: 'payout',
                        amount: 8, // Rounded winnings
                    }),
                    expect.objectContaining({
                        user_id: 3,
                        type: 'escrow_out',
                        amount: 20,
                    }),
                ]),
                expect.any(Object),
            );
        });

        it('should handle void settlement by returning all stakes', async () => {
            const voidInteraction = {
                user: { id: 'moderator-id', username: 'moderator' },
                guild: { id: 'test-guild-id' },
                member: {
                    permissions: { has: jest.fn().mockReturnValue(true) },
                },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('settle'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'void-bet-uuid';
                            case 'outcome': return 'void';
                            default: return null;
                        }
                    }),
                },
            };

            const bet = {
                id: 'void-bet-uuid',
                status: 'closed',
                total_for: 30,
                total_against: 20,
                update: jest.fn(),
            };

            const participants = [
                { user_id: 1, side: 'for', amount: 30 },
                { user_id: 2, side: 'against', amount: 20 },
            ];

            const userABalance = { current_balance: 70, escrow_balance: 30, update: jest.fn() };
            const userBBalance = { current_balance: 80, escrow_balance: 20, update: jest.fn() };

            mockBetWagers.findByPk.mockResolvedValue(bet);
            mockBetParticipants.findAll.mockResolvedValue(participants);
            mockBetBalances.findOne.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve(userABalance);
                    case 2: return Promise.resolve(userBBalance);
                    default: return Promise.resolve(null);
                }
            });

            await betCommand.execute(voidInteraction as any, mockContext);

            // Both users get their stakes back
            expect(userABalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 100, // 70 + 30 returned
                    escrow_balance: 0,
                }),
                expect.any(Object),
            );

            expect(userBBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 100, // 80 + 20 returned
                    escrow_balance: 0,
                }),
                expect.any(Object),
            );

            // Ledger shows refunds
            expect(mockBetLedger.bulkCreate).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        user_id: 1,
                        type: 'void',
                        amount: 30,
                    }),
                    expect.objectContaining({
                        user_id: 2,
                        type: 'void',
                        amount: 20,
                    }),
                ]),
                expect.any(Object),
            );
        });

        it('should handle different odds ratios correctly', async () => {
            // Arrange: 2:1 odds favoring "against"
            const moderatorInteraction = {
                user: { id: 'moderator-id', username: 'moderator' },
                guild: { id: 'test-guild-id' },
                member: {
                    permissions: { has: jest.fn().mockReturnValue(true) },
                },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('settle'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'odds-bet-uuid';
                            case 'outcome': return 'against';
                            default: return null;
                        }
                    }),
                },
            };

            const bet = {
                id: 'odds-bet-uuid',
                status: 'closed',
                total_for: 20,
                total_against: 10,
                odds_for: 1,    // 1:2 odds - "for" bettors get less
                odds_against: 2, // 2:1 odds - "against" bettors get more
                update: jest.fn(),
            };

            const participants = [
                { user_id: 1, side: 'for', amount: 20 },
                { user_id: 2, side: 'against', amount: 10 },
            ];

            const userABalance = { current_balance: 80, escrow_balance: 20, update: jest.fn() };
            const userBBalance = { current_balance: 90, escrow_balance: 10, update: jest.fn() };

            mockBetWagers.findByPk.mockResolvedValue(bet);
            mockBetParticipants.findAll.mockResolvedValue(participants);
            mockBetBalances.findOne.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve(userABalance);
                    case 2: return Promise.resolve(userBBalance);
                    default: return Promise.resolve(null);
                }
            });

            await betCommand.execute(moderatorInteraction as any, mockContext);

            // User B (against winner) gets: 10 stake + (2 * 20 / 1) winnings = 10 + 40 = 50
            expect(userBBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 130, // 90 + 40 (10 stake + 30 winnings)
                    escrow_balance: 0,
                }),
                expect.any(Object),
            );
        });

        it('should prevent non-moderators from settling bets', async () => {
            const nonModInteraction = {
                user: { id: 'regular-user-id', username: 'regularuser' },
                guild: { id: 'test-guild-id' },
                member: {
                    permissions: { has: jest.fn().mockReturnValue(false) }, // No perms
                },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('settle'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'bet-uuid';
                            case 'outcome': return 'for';
                            default: return null;
                        }
                    }),
                },
            };

            await betCommand.execute(nonModInteraction as any, mockContext);

            expect(nonModInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('moderator permissions'),
                    ephemeral: true,
                }),
            );
            expect(mockBetWagers.update).not.toHaveBeenCalled();
        });

        it('should prevent settling already settled bets', async () => {
            const doubleSettleInteraction = {
                user: { id: 'moderator-id', username: 'moderator' },
                guild: { id: 'test-guild-id' },
                member: {
                    permissions: { has: jest.fn().mockReturnValue(true) },
                },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('settle'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'settled-bet-uuid';
                            case 'outcome': return 'for';
                            default: return null;
                        }
                    }),
                },
            };

            mockBetWagers.findByPk.mockResolvedValue({
                id: 'settled-bet-uuid',
                status: 'settled', // Already settled
                outcome: 'against',
            });

            await betCommand.execute(doubleSettleInteraction as any, mockContext);

            expect(doubleSettleInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('already settled'),
                    ephemeral: true,
                }),
            );
        });
    });
});