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

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock database models
        mockBetUsers = {
            findOrCreate: jest.fn(),
            findOne: jest.fn(),
            create: jest.fn(),
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

        // Create a mock transaction object
        const mockTransaction = {
            commit: jest.fn(),
            rollback: jest.fn(),
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
                switch (name) {
                    case 'statement': return 'Will it rain tomorrow?';
                    case 'ends': return '6h';
                    case 'odds': return '1:1';
                    default: return null;
                }
            });
            mockInteraction.options.getInteger.mockReturnValue(25);
        });

        it('should fail when user has insufficient balance', async () => {
            mockBetUsers.findOrCreate.mockResolvedValue([{ id: 1, discord_id: 'test-user-id' }]);
            mockBetBalances.findOrCreate.mockResolvedValue([{ current_balance: 10 }]);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('insufficient'),
                    ephemeral: true,
                }),
            );
        });

        it('should create bet and move amount to escrow when valid', async () => {
            mockBetUsers.findOrCreate.mockResolvedValue([{ id: 1, discord_id: 'test-user-id' }]);
            mockBetBalances.findOrCreate.mockResolvedValue([{ current_balance: 100 }]);
            mockBetWagers.create.mockResolvedValue({
                id: 'bet-uuid',
                statement: 'Will it rain tomorrow?',
                closes_at: new Date(Date.now() + 6 * 60 * 60 * 1000),
            });


            await betCommand.execute(mockInteraction, mockContext);

            expect(mockBetWagers.create).toHaveBeenCalled();
            expect(mockBetBalances.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 75,
                    escrow_balance: 25,
                }),
                expect.any(Object),
            );
            expect(mockBetLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    type: 'escrow_in',
                    amount: 25,
                }),
                expect.any(Object),
            );
        });

        it('should validate statement length', async () => {
            mockInteraction.options.getString.mockImplementation((name: string) => {
                if (name === 'statement') {return 'x';} // Too short
                return '6h';
            });

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('10 and 200 characters'),
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
                    case 'id': return 'bet-uuid';
                    case 'side': return 'for';
                    default: return null;
                }
            });
            mockInteraction.options.getInteger.mockReturnValue(15);
        });

        it('should fail when bet does not exist', async () => {
            mockBetWagers.findByPk.mockResolvedValue(null);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Bet not found'),
                    ephemeral: true,
                }),
            );
        });

        it('should fail when bet is not open', async () => {
            mockBetWagers.findByPk.mockResolvedValue({
                status: 'settled',
                statement: 'Test bet',
            });

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('no longer accepting'),
                    ephemeral: true,
                }),
            );
        });

        it('should join bet successfully when valid', async () => {
            mockBetUsers.findOrCreate.mockResolvedValue([{ id: 1 }]);
            mockBetBalances.findOrCreate.mockResolvedValue([{ current_balance: 50 }]);
            mockBetWagers.findByPk.mockResolvedValue({
                id: 'bet-uuid',
                status: 'open',
                closes_at: new Date(Date.now() + 3600000),
                statement: 'Test bet',
            });


            await betCommand.execute(mockInteraction, mockContext);

            expect(mockBetParticipants.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    side: 'for',
                    amount: 15,
                }),
                expect.any(Object),
            );
        });
    });

    describe('/bet list subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('list');
            mockInteraction.options.getString.mockReturnValue('open');
        });

        it('should list open bets', async () => {
            mockBetWagers.findAll.mockResolvedValue([
                {
                    id: 'bet-1',
                    statement: 'Test bet 1',
                    status: 'open',
                    total_for: 50,
                    total_against: 30,
                    closes_at: new Date(Date.now() + 3600000),
                    BetUser: { handle: 'testuser' },
                },
            ]);

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
                }),
            );
        });
    });

    describe('/bet settle subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('settle');
            mockInteraction.options.getString.mockImplementation((name: string) => {
                switch (name) {
                    case 'id': return 'bet-uuid';
                    case 'outcome': return 'for';
                    default: return null;
                }
            });
            // Mock moderator permissions
            mockInteraction.member.permissions.has.mockReturnValue(true);
        });

        it('should fail without moderator permissions', async () => {
            mockInteraction.member.permissions.has.mockReturnValue(false);

            await betCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('moderator permissions'),
                    ephemeral: true,
                }),
            );
        });

        it('should settle bet and distribute payouts', async () => {
            mockBetWagers.findByPk.mockResolvedValue({
                id: 'bet-uuid',
                status: 'closed',
                total_for: 40,
                total_against: 20,
                odds_for: 1,
                odds_against: 1,
            });

            mockBetParticipants.findAll.mockResolvedValue([
                { user_id: 1, side: 'for', amount: 25 },
                { user_id: 2, side: 'for', amount: 15 },
                { user_id: 3, side: 'against', amount: 20 },
            ]);


            await betCommand.execute(mockInteraction, mockContext);

            expect(mockBetWagers.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    status: 'settled',
                    outcome: 'for',
                }),
                expect.any(Object),
            );
        });
    });
});