import { SlashCommandBuilder } from 'discord.js';
import betCommand from './bet';
import { Context } from '../utils/types';

describe('bet command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockBetUsers: any;
    let mockBetBalances: any;
    let mockBetWagers: any;
    let mockBetParticipants: any;
    let mockBetLedger: any;
    let mockTransaction: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock database models
        mockBetUsers = {
            findOne: jest.fn(),
            create: jest.fn(),
        };

        mockBetBalances = {
            findOne: jest.fn(),
            create: jest.fn(),
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
            findOne: jest.fn(),
            sum: jest.fn(),
            count: jest.fn(),
        };

        mockBetLedger = {
            create: jest.fn(),
            findAll: jest.fn(),
        };

        // Create mock transaction
        mockTransaction = {
            commit: jest.fn(),
            rollback: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'test-user-id', username: 'testuser' },
            guild: { id: 'test-guild-id' },
            member: {
                permissions: { has: jest.fn().mockReturnValue(false) },
                roles: { cache: { has: jest.fn().mockReturnValue(false) } },
            },
            reply: jest.fn(),
            followUp: jest.fn(),
            editReply: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getInteger: jest.fn(),
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
                BetWagers: mockBetWagers,
                BetParticipants: mockBetParticipants,
                BetLedger: mockBetLedger,
            },
            sequelize: {
                transaction: jest.fn().mockResolvedValue(mockTransaction),
            },
        } as any;
    });

    describe('command data', () => {
        it('should have correct command name and description', () => {
            expect(betCommand.data).toBeInstanceOf(SlashCommandBuilder);
            expect(betCommand.data.name).toBe('bet');
            expect(betCommand.data.description).toContain('Betting system for Sparks currency');
        });

        it('should have all required subcommands', () => {
            const commandData = betCommand.data.toJSON();
            const subcommands = commandData.options?.filter(opt => opt.type === 1) || [];
            const subcommandNames = subcommands.map(sub => sub.name);

            expect(subcommandNames).toContain('open');
            expect(subcommandNames).toContain('join');
            expect(subcommandNames).toContain('list');
            expect(subcommandNames).toContain('settle');
        });
    });

    describe('/bet open subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('open');
            mockInteraction.options.getString.mockImplementation((name: string) => {
                if (name === 'statement') {return 'Will it rain tomorrow?';}
                return null;
            });
            mockInteraction.options.getInteger.mockImplementation((name: string) => {
                switch (name) {
                    case 'odds_for': return 2;
                    case 'odds_against': return 1;
                    case 'duration': return 60;
                    default: return null;
                }
            });
        });

        it('should create bet successfully with new user', async () => {
            const mockUser = { id: 1, discord_id: 'test-user-id' };
            const mockBalance = { available_balance: 100, escrowed_balance: 0 };
            const mockBet = {
                id: 'bet-uuid-123',
                statement: 'Will it rain tomorrow?',
                odds_for: 2,
                odds_against: 1,
                closes_at: new Date(Date.now() + 60 * 60 * 1000),
            };

            mockBetUsers.findOne.mockResolvedValue(null); // User doesn't exist
            mockBetUsers.create.mockResolvedValue(mockUser);
            mockBetBalances.create.mockResolvedValue(mockBalance);
            mockBetWagers.create.mockResolvedValue(mockBet);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockBetUsers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    discord_id: 'test-user-id',
                    handle: null,
                    hide_last_seen: false,
                }),
                expect.objectContaining({ transaction: mockTransaction }),
            );

            expect(mockBetWagers.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    opener_id: 1,
                    statement: 'Will it rain tomorrow?',
                    odds_for: 2,
                    odds_against: 1,
                    status: 'open',
                }),
                expect.objectContaining({ transaction: mockTransaction }),
            );

            expect(mockTransaction.commit).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('New Bet Created'),
                                description: '**Will it rain tomorrow?**',
                            }),
                        }),
                    ]),
                    components: expect.any(Array),
                }),
            );
        });

        it('should validate statement length', async () => {
            mockInteraction.options.getString.mockImplementation((name: string) => {
                if (name === 'statement') {return 'x'.repeat(201);} // Too long
                return null;
            });

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('200 characters or less'),
                    ephemeral: true,
                }),
            );
        });

        it('should handle database errors with rollback', async () => {
            mockBetUsers.findOne.mockRejectedValue(new Error('Database error'));

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Database error'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('/bet join subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('join');
            mockInteraction.options.getString.mockImplementation((name: string) => {
                switch (name) {
                    case 'bet_id': return 'bet-uuid';
                    case 'side': return 'for';
                    default: return null;
                }
            });
            mockInteraction.options.getInteger.mockReturnValue(15);
        });

        it('should fail when bet does not exist', async () => {
            mockBetUsers.findOne.mockResolvedValue({ id: 1 }); // Mock existing user
            mockBetBalances.findOne.mockResolvedValue({ available_balance: 50, escrowed_balance: 0 });
            mockBetWagers.findByPk.mockResolvedValue(null); // Bet doesn't exist

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Bet not found'),
                    ephemeral: true,
                }),
            );
        });

        it('should fail when bet is not open', async () => {
            mockBetUsers.findOne.mockResolvedValue({ id: 1 });
            mockBetBalances.findOne.mockResolvedValue({ available_balance: 50, escrowed_balance: 0 });
            mockBetWagers.findByPk.mockResolvedValue({
                id: 'bet-uuid',
                status: 'settled',
                closes_at: new Date(Date.now() + 3600000),
                statement: 'Test bet',
            });

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('no longer accepting'),
                    ephemeral: true,
                }),
            );
        });

        it('should fail when user has insufficient balance', async () => {
            mockBetUsers.findOne.mockResolvedValue({ id: 1 });
            mockBetBalances.findOne.mockResolvedValue({ available_balance: 10, escrowed_balance: 0 }); // Not enough
            mockBetWagers.findByPk.mockResolvedValue({
                id: 'bet-uuid',
                status: 'open',
                closes_at: new Date(Date.now() + 3600000),
            });

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Insufficient balance'),
                    ephemeral: true,
                }),
            );
        });

        it('should join bet successfully when valid', async () => {
            const mockUser = { id: 1 };
            const mockBalance = {
                available_balance: 50,
                escrowed_balance: 0,
                update: jest.fn(),
            };
            const mockBet = {
                id: 'bet-uuid',
                status: 'open',
                closes_at: new Date(Date.now() + 3600000),
                statement: 'Test bet',
                total_for: 0,
                total_against: 0,
                save: jest.fn(),
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetBalances.findOne.mockResolvedValue(mockBalance);
            mockBetWagers.findByPk.mockResolvedValue(mockBet);
            mockBetParticipants.findOne.mockResolvedValue(null); // User hasn't participated yet

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockBetParticipants.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    bet_id: 'bet-uuid',
                    user_id: 1,
                    side: 'for',
                    amount: 15,
                }),
                expect.objectContaining({ transaction: mockTransaction }),
            );

            expect(mockBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    available_balance: 35, // 50 - 15
                    escrowed_balance: 15,   // 0 + 15
                }),
                expect.objectContaining({ transaction: mockTransaction }),
            );

            expect(mockTransaction.commit).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Successfully joined bet'),
                    ephemeral: true,
                }),
            );
        });

        it('should prevent joining same bet twice', async () => {
            const mockUser = { id: 1 };
            const mockBalance = { available_balance: 50, escrowed_balance: 0 };
            const mockBet = {
                id: 'bet-uuid',
                status: 'open',
                closes_at: new Date(Date.now() + 3600000),
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetBalances.findOne.mockResolvedValue(mockBalance);
            mockBetWagers.findByPk.mockResolvedValue(mockBet);
            mockBetParticipants.findOne.mockResolvedValue({ id: 1 }); // User already participated

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('already joined this bet'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('/bet list subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('list');
        });

        it('should list active bets', async () => {
            const mockBets = [
                {
                    id: 'bet-1',
                    statement: 'Test bet 1',
                    status: 'open',
                    odds_for: 2,
                    odds_against: 1,
                    total_for: 50,
                    total_against: 30,
                    closes_at: new Date(Date.now() + 3600000),
                },
            ];

            mockBetWagers.findAll.mockResolvedValue(mockBets);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                title: expect.stringContaining('Active Bets'),
                            }),
                        }),
                    ]),
                    ephemeral: true,
                }),
            );
        });

        it('should handle no active bets', async () => {
            mockBetWagers.findAll.mockResolvedValue([]);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No active bets found'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('/bet settle subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('settle');
            mockInteraction.options.getString.mockImplementation((name: string) => {
                switch (name) {
                    case 'bet_id': return 'bet-uuid';
                    case 'outcome': return 'for';
                    default: return null;
                }
            });
        });

        it('should fail when user is not the bet opener', async () => {
            const mockUser = { id: 1 };
            const mockBet = {
                id: 'bet-uuid',
                opener_id: 2, // Different user
                status: 'open',
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetWagers.findByPk.mockResolvedValue(mockBet);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Only the bet opener can settle'),
                    ephemeral: true,
                }),
            );
        });

        it('should settle bet and distribute payouts', async () => {
            const mockUser = { id: 1 };
            const mockBet = {
                id: 'bet-uuid',
                opener_id: 1, // Same user
                status: 'open',
                statement: 'Test bet',
                odds_for: 2,
                odds_against: 1,
                update: jest.fn(),
            };
            const mockParticipants = [
                { user_id: 2, side: 'for', amount: 25 },
                { user_id: 3, side: 'for', amount: 15 },
                { user_id: 4, side: 'against', amount: 20 },
            ];
            const mockBalance = {
                available_balance: 0,
                escrowed_balance: 0,
                update: jest.fn(),
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetWagers.findByPk.mockResolvedValue(mockBet);
            mockBetParticipants.findAll.mockResolvedValue(mockParticipants);
            mockBetBalances.findOne.mockResolvedValue(mockBalance);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockBet.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'settled',
                    outcome: 'for',
                }),
                expect.objectContaining({ transaction: mockTransaction }),
            );

            expect(mockTransaction.commit).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('settled as FOR'),
                }),
            );
        });

        it('should handle void outcome by refunding all participants', async () => {
            mockInteraction.options.getString.mockImplementation((name: string) => {
                switch (name) {
                    case 'bet_id': return 'bet-uuid';
                    case 'outcome': return 'void';
                    default: return null;
                }
            });

            const mockUser = { id: 1 };
            const mockBet = {
                id: 'bet-uuid',
                opener_id: 1,
                status: 'open',
                statement: 'Test bet',
                update: jest.fn(),
            };
            const mockParticipants = [
                { user_id: 2, side: 'for', amount: 25 },
            ];
            const mockBalance = {
                available_balance: 0,
                escrowed_balance: 25,
                update: jest.fn(),
            };

            mockBetUsers.findOne.mockResolvedValue(mockUser);
            mockBetWagers.findByPk.mockResolvedValue(mockBet);
            mockBetParticipants.findAll.mockResolvedValue(mockParticipants);
            mockBetBalances.findOne.mockResolvedValue(mockBalance);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    available_balance: 25, // Refunded
                    escrowed_balance: 0,   // Released
                }),
                expect.objectContaining({ transaction: mockTransaction }),
            );

            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'refund',
                    amount: 25,
                }),
                expect.objectContaining({ transaction: mockTransaction }),
            );
        });
    });

    describe('invalid subcommand', () => {
        it('should handle invalid subcommand', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('invalid');

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: 'Invalid subcommand.',
                    ephemeral: true,
                }),
            );
        });
    });
});