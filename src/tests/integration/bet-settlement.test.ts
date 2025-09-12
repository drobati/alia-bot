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
            create: jest.fn(),
        };

        mockBetBalances = {
            findOne: jest.fn(),
            findOrCreate: jest.fn(),
            update: jest.fn(),
            create: jest.fn(),
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
            transaction: jest.fn().mockImplementation((callbackOrOptions, callback) => {
                // Handle both transaction() and transaction(options, callback)
                if (typeof callbackOrOptions === 'function') {
                    return callbackOrOptions(mockTransaction);
                } else if (typeof callback === 'function') {
                    return callback(mockTransaction);
                } else {
                    // Return a promise that resolves to the transaction
                    return Promise.resolve(mockTransaction);
                }
            }),
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
                            case 'bet_id': return 'bet-uuid';
                            case 'outcome': return 'for';
                            default: return null;
                        }
                    }),
                },
            };

            // Mock bet with participants: 40 "for", 20 "against"
            const bet = {
                id: 'bet-uuid',
                opener_id: 1, // Same as settling user
                status: 'open', // Must be 'open' to be settable
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
                available_balance: 75, // Had 25 in escrow
                escrowed_balance: 25,
                update: jest.fn(),
            };
            const userBBalance = {
                available_balance: 35, // Had 15 in escrow
                escrowed_balance: 15,
                update: jest.fn(),
            };
            const userCBalance = {
                available_balance: 60, // Had 20 in escrow
                escrowed_balance: 20,
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
            mockBetBalances.findOrCreate.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve([userABalance, false]);
                    case 2: return Promise.resolve([userBBalance, false]);
                    case 3: return Promise.resolve([userCBalance, false]);
                    default: return Promise.resolve([null, false]);
                }
            });

            // Mock user lookup for settlement
            const settlingUser = { id: 1, discord_id: 'moderator-id' };
            mockBetUsers.findOne.mockResolvedValue(settlingUser);
            mockBetUsers.findOrCreate.mockResolvedValue([settlingUser, false]);

            // Update bet to include opener_id - make settler the opener  
            (bet as any).opener_id = 1;

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

            // Assert: Winners receive payouts based on their odds
            // User A: Gets 25 stake + (25 * 1 odds) = 50 total payout
            expect(userABalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    available_balance: 125, // 75 + 50
                }),
                expect.any(Object),
            );

            // User B: Gets 15 stake + (15 * 1 odds) = 30 total payout  
            expect(userBBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    available_balance: 65, // 35 + 30
                }),
                expect.any(Object),
            );

            // User C: Loses - only escrow is released, no payout
            expect(userCBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    escrowed_balance: 0, // Escrow cleared
                }),
                expect.any(Object),
            );

            // Assert: Ledger entries created for payouts  
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    type: 'escrow_out',
                    amount: 25,
                }),
                expect.any(Object),
            );
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    type: 'payout',
                    amount: 50, // Total payout including stake
                }),
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
                            case 'bet_id': return 'void-bet-uuid';
                            case 'outcome': return 'void';
                            default: return null;
                        }
                    }),
                },
            };

            const bet = {
                id: 'void-bet-uuid',
                opener_id: 1, // Same as settling user
                status: 'open', // Must be 'open' to be settable
                total_for: 30,
                total_against: 20,
                update: jest.fn(),
            };

            const participants = [
                { user_id: 1, side: 'for', amount: 30 },
                { user_id: 2, side: 'against', amount: 20 },
            ];

            const userABalance = { available_balance: 70, escrowed_balance: 30, update: jest.fn() };
            const userBBalance = { available_balance: 80, escrowed_balance: 20, update: jest.fn() };

            // Mock user lookup for void settlement
            const settlingUser = { id: 1, discord_id: 'moderator-id' };
            mockBetUsers.findOne.mockResolvedValue(settlingUser);
            mockBetUsers.findOrCreate.mockResolvedValue([settlingUser, false]);
            
            mockBetWagers.findByPk.mockResolvedValue(bet);
            mockBetParticipants.findAll.mockResolvedValue(participants);
            mockBetBalances.findOne.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve(userABalance);
                    case 2: return Promise.resolve(userBBalance);
                    default: return Promise.resolve(null);
                }
            });
            mockBetBalances.findOrCreate.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve([userABalance, false]);
                    case 2: return Promise.resolve([userBBalance, false]);
                    default: return Promise.resolve([null, false]);
                }
            });

            await betCommand.execute(voidInteraction as any, mockContext);

            // Both users get their stakes back
            expect(userABalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    available_balance: 100, // 70 + 30 returned
                    escrowed_balance: 0,
                }),
                expect.any(Object),
            );

            expect(userBBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    available_balance: 100, // 80 + 20 returned
                    escrowed_balance: 0,
                }),
                expect.any(Object),
            );

            // Ledger shows refunds
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    type: 'refund',
                    amount: 30,
                }),
                expect.any(Object),
            );
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 2,
                    type: 'refund',
                    amount: 20,
                }),
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
                            case 'bet_id': return 'odds-bet-uuid';
                            case 'outcome': return 'against';
                            default: return null;
                        }
                    }),
                },
            };

            const bet = {
                id: 'odds-bet-uuid',
                opener_id: 1, // Same as settling user
                status: 'open', // Must be 'open' to be settable
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

            const userABalance = { available_balance: 80, escrowed_balance: 20, update: jest.fn() };
            const userBBalance = { available_balance: 90, escrowed_balance: 10, update: jest.fn() };

            // Mock user lookup for odds settlement
            const settlingUser = { id: 1, discord_id: 'moderator-id' };
            mockBetUsers.findOne.mockResolvedValue(settlingUser);
            mockBetUsers.findOrCreate.mockResolvedValue([settlingUser, false]);

            mockBetWagers.findByPk.mockResolvedValue(bet);
            mockBetParticipants.findAll.mockResolvedValue(participants);
            mockBetBalances.findOne.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve(userABalance);
                    case 2: return Promise.resolve(userBBalance);
                    default: return Promise.resolve(null);
                }
            });
            mockBetBalances.findOrCreate.mockImplementation(({ where }: any) => {
                switch (where.user_id) {
                    case 1: return Promise.resolve([userABalance, false]);
                    case 2: return Promise.resolve([userBBalance, false]);
                    default: return Promise.resolve([null, false]);
                }
            });

            await betCommand.execute(moderatorInteraction as any, mockContext);

            // User B (against winner) gets: 10 stake + (10 * 2 odds) = 30 total payout
            expect(userBBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    available_balance: 120, // 90 + 30
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
                            case 'bet_id': return 'bet-uuid';
                            case 'outcome': return 'for';
                            default: return null;
                        }
                    }),
                },
            };

            // Mock user not found (should not reach opener check)
            const mockUser = { id: 1, discord_id: 'regular-user-id' };
            const mockBet = { id: 'bet-uuid', opener_id: 2, status: 'open', statement: 'Test bet' }; // Different opener

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetWagers.findByPk.mockResolvedValue(mockBet);

            await betCommand.execute(nonModInteraction as any, mockContext);

            expect(nonModInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Only the bet opener can settle'),
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
                            case 'bet_id': return 'settled-bet-uuid';
                            case 'outcome': return 'for';
                            default: return null;
                        }
                    }),
                },
            };

            // Mock user for this test
            const mockUser = { id: 1, discord_id: 'moderator-id' };
            mockBetUsers.findOne.mockResolvedValue(mockUser);

            mockBetWagers.findByPk.mockResolvedValue({
                id: 'settled-bet-uuid',
                opener_id: 1, // Same as user id (opener can settle)
                status: 'settled', // Already settled
                outcome: 'against',
            });

            await betCommand.execute(doubleSettleInteraction as any, mockContext);

            expect(doubleSettleInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('This bet has already been settled'),
                    ephemeral: true,
                }),
            );
        });
    });
});