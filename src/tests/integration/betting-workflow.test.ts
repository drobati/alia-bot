import betCommand from '../../commands/bet';
import { Context } from '../../utils/types';

describe('Creating and Joining Bets Workflow Integration', () => {
    let mockContext: Context;
    let mockBetUsers: any;
    let mockBetBalances: any;
    let mockBetWagers: any;
    let mockBetParticipants: any;
    let mockBetLedger: any;
    let mockSequelize: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock database models with full CRUD operations
        mockBetUsers = {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
        };

        mockBetBalances = {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
            update: jest.fn(),
        };

        mockBetWagers = {
            create: jest.fn(),
            findByPk: jest.fn(),
            findAll: jest.fn(),
            update: jest.fn(),
        };

        mockBetParticipants = {
            create: jest.fn(),
            findAll: jest.fn(),
            sum: jest.fn(),
            count: jest.fn(),
        };

        mockBetLedger = {
            create: jest.fn(),
            findAll: jest.fn(),
        };

        // Mock transaction with proper commit/rollback
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

    describe('Scenario 2: Creating and Joining Bets', () => {
        it('should complete full betting workflow from creation to participation', async () => {
            // Step 1: User A creates bet
            const userAInteraction = {
                user: { id: 'user-a-id', username: 'userA' },
                guild: { id: 'test-guild-id' },
                member: { permissions: { has: jest.fn().mockReturnValue(false) } },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('open'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'statement': return 'Will it rain tomorrow?';
                            case 'ends': return '6h';
                            case 'odds': return '1:1';
                            default: return null;
                        }
                    }),
                    getInteger: jest.fn().mockReturnValue(25),
                },
            };

            const userA = { id: 1, discord_id: 'user-a-id' };
            const userABalance = {
                current_balance: 100,
                escrow_balance: 0,
                lifetime_earned: 100,
                lifetime_spent: 0,
                update: jest.fn(),
            };
            const createdBet = {
                id: 'bet-uuid',
                opener_id: 1,
                statement: 'Will it rain tomorrow?',
                total_for: 25,
                total_against: 0,
                status: 'open',
                closes_at: new Date(Date.now() + 6 * 60 * 60 * 1000),
            };

            mockBetUsers.findOrCreate.mockResolvedValue([userA, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([userABalance, false]);
            mockBetWagers.create.mockResolvedValue(createdBet);

            // Act: User A creates bet
            await betCommand.execute(userAInteraction as any, mockContext);

            // Assert: Bet created and escrow deducted
            expect(mockBetWagers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    opener_id: 1,
                    statement: 'Will it rain tomorrow?',
                    total_for: 25,
                }),
                expect.any(Object),
            );
            expect(userABalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 75, // 100 - 25
                    escrow_balance: 25,
                }),
                expect.any(Object),
            );
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    user_id: 1,
                    type: 'escrow_in',
                    amount: 25,
                    ref_type: 'bet',
                    ref_id: 'bet-uuid',
                }),
                expect.any(Object),
            );

            // Step 2: User B joins bet "for" side
            const userBInteraction = {
                user: { id: 'user-b-id', username: 'userB' },
                guild: { id: 'test-guild-id' },
                member: { permissions: { has: jest.fn().mockReturnValue(false) } },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('join'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'bet-uuid';
                            case 'side': return 'for';
                            default: return null;
                        }
                    }),
                    getInteger: jest.fn().mockReturnValue(15),
                },
            };

            const userB = { id: 2, discord_id: 'user-b-id' };
            const userBBalance = {
                current_balance: 50,
                escrow_balance: 0,
                update: jest.fn(),
            };

            // Reset mocks for user B
            mockBetUsers.findOrCreate.mockResolvedValue([userB, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([userBBalance, false]);
            mockBetWagers.findByPk.mockResolvedValue({
                ...createdBet,
                status: 'open',
                closes_at: new Date(Date.now() + 5 * 60 * 60 * 1000), // Still open
            });

            // Act: User B joins bet
            await betCommand.execute(userBInteraction as any, mockContext);

            // Assert: User B joined and escrow updated
            expect(mockBetParticipants.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    bet_id: 'bet-uuid',
                    user_id: 2,
                    side: 'for',
                    amount: 15,
                }),
                expect.any(Object),
            );
            expect(userBBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 35, // 50 - 15
                    escrow_balance: 15,
                }),
                expect.any(Object),
            );

            // Step 3: User C joins bet "against" side
            const userCInteraction = {
                user: { id: 'user-c-id', username: 'userC' },
                guild: { id: 'test-guild-id' },
                member: { permissions: { has: jest.fn().mockReturnValue(false) } },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('join'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'bet-uuid';
                            case 'side': return 'against';
                            default: return null;
                        }
                    }),
                    getInteger: jest.fn().mockReturnValue(20),
                },
            };

            const userC = { id: 3, discord_id: 'user-c-id' };
            const userCBalance = {
                current_balance: 80,
                escrow_balance: 0,
                update: jest.fn(),
            };

            mockBetUsers.findOrCreate.mockResolvedValue([userC, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([userCBalance, false]);

            // Act: User C joins bet
            await betCommand.execute(userCInteraction as any, mockContext);

            // Assert: User C joined against side
            expect(mockBetParticipants.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    bet_id: 'bet-uuid',
                    user_id: 3,
                    side: 'against',
                    amount: 20,
                }),
                expect.any(Object),
            );
            expect(userCBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 60, // 80 - 20
                    escrow_balance: 20,
                }),
                expect.any(Object),
            );
        });

        it('should prevent joining bet after closing time', async () => {
            const lateJoinInteraction = {
                user: { id: 'late-user-id', username: 'lateuser' },
                guild: { id: 'test-guild-id' },
                member: { permissions: { has: jest.fn().mockReturnValue(false) } },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('join'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'bet-uuid';
                            case 'side': return 'for';
                            default: return null;
                        }
                    }),
                    getInteger: jest.fn().mockReturnValue(10),
                },
            };

            // Mock closed bet
            mockBetWagers.findByPk.mockResolvedValue({
                id: 'bet-uuid',
                statement: 'Expired bet',
                status: 'open',
                closes_at: new Date(Date.now() - 1000), // Already expired
            });

            await betCommand.execute(lateJoinInteraction as any, mockContext);

            expect(lateJoinInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('closed'),
                    ephemeral: true,
                }),
            );
            expect(mockBetParticipants.create).not.toHaveBeenCalled();
        });

        it('should prevent double-joining same bet on same side', async () => {
            const doubleJoinInteraction = {
                user: { id: 'double-user-id', username: 'doubleuser' },
                guild: { id: 'test-guild-id' },
                member: { permissions: { has: jest.fn().mockReturnValue(false) } },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('join'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'bet-uuid';
                            case 'side': return 'for';
                            default: return null;
                        }
                    }),
                    getInteger: jest.fn().mockReturnValue(10),
                },
            };

            const user = { id: 4, discord_id: 'double-user-id' };
            mockBetUsers.findOrCreate.mockResolvedValue([user, false]);
            mockBetWagers.findByPk.mockResolvedValue({
                id: 'bet-uuid',
                status: 'open',
                closes_at: new Date(Date.now() + 3600000),
            });

            // Mock existing participation
            mockBetParticipants.create.mockRejectedValue({
                name: 'SequelizeUniqueConstraintError',
                message: 'Unique constraint error',
            });

            await betCommand.execute(doubleJoinInteraction as any, mockContext);

            expect(doubleJoinInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('already joined'),
                    ephemeral: true,
                }),
            );
        });

        it('should update bet totals when participants join', async () => {
            const joinInteraction = {
                user: { id: 'joiner-id', username: 'joiner' },
                guild: { id: 'test-guild-id' },
                member: { permissions: { has: jest.fn().mockReturnValue(false) } },
                reply: jest.fn(),
                options: {
                    getSubcommand: jest.fn().mockReturnValue('join'),
                    getString: jest.fn().mockImplementation(name => {
                        switch (name) {
                            case 'id': return 'bet-uuid';
                            case 'side': return 'for';
                            default: return null;
                        }
                    }),
                    getInteger: jest.fn().mockReturnValue(30),
                },
            };

            const user = { id: 5, discord_id: 'joiner-id' };
            const userBalance = { current_balance: 50, update: jest.fn() };
            const bet = {
                id: 'bet-uuid',
                status: 'open',
                total_for: 25, // Existing total
                total_against: 10,
                closes_at: new Date(Date.now() + 3600000),
                update: jest.fn(),
            };

            mockBetUsers.findOrCreate.mockResolvedValue([user, false]);
            mockBetBalances.findOrCreate.mockResolvedValue([userBalance, false]);
            mockBetWagers.findByPk.mockResolvedValue(bet);

            await betCommand.execute(joinInteraction as any, mockContext);

            // Should update bet totals
            expect(bet.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    total_for: 55, // 25 + 30
                }),
                expect.any(Object),
            );
        });
    });
});