import { ChatInputCommandInteraction } from 'discord.js';
import tributeCommand from './tribute';
import { Context } from '../utils/types';

describe('Tribute Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockContext: Context;
    let mockSpiceBalance: any;
    let mockSpiceLedger: any;
    let mockTransaction: any;

    beforeEach(() => {
        mockInteraction = {
            options: {
                getUser: jest.fn().mockReturnValue({
                    id: 'target-user-id',
                    username: 'targetuser',
                    bot: false,
                }),
                getInteger: jest.fn().mockReturnValue(50),
            } as any,
            user: {
                id: 'test-user-id',
                username: 'testuser',
                toString: () => '<@test-user-id>',
            } as any,
            guild: {
                id: 'test-guild-id',
            } as any,
            reply: jest.fn().mockResolvedValue(undefined),
        } as any;

        mockTransaction = {
            commit: jest.fn().mockResolvedValue(undefined),
            rollback: jest.fn().mockResolvedValue(undefined),
        };

        mockSpiceBalance = {
            findOne: jest.fn(),
            findOrCreate: jest.fn(),
        };

        mockSpiceLedger = {
            create: jest.fn().mockResolvedValue({}),
        };

        mockContext = {
            tables: {
                SpiceBalance: mockSpiceBalance,
                SpiceLedger: mockSpiceLedger,
            },
            log: {
                info: jest.fn(),
                error: jest.fn(),
            },
            sequelize: {
                transaction: jest.fn().mockResolvedValue(mockTransaction),
            },
        } as any;

        jest.clearAllMocks();
    });

    describe('Command Definition', () => {
        it('should have correct name and description', () => {
            expect(tributeCommand.data.name).toBe('tribute');
            expect(tributeCommand.data.description).toBe('Pay tribute in spice to another member of the sietch');
        });

        it('should have required user and amount options', () => {
            const commandData = tributeCommand.data.toJSON();
            const userOption = commandData.options?.find((opt: any) => opt.name === 'user');
            const amountOption = commandData.options?.find((opt: any) => opt.name === 'amount');

            expect(userOption).toBeDefined();
            expect(userOption?.required).toBe(true);
            expect(amountOption).toBeDefined();
            expect(amountOption?.required).toBe(true);
            expect((amountOption as any)?.min_value).toBe(1);
        });
    });

    describe('Execute Function', () => {
        it('should reject if not in a guild', async () => {
            const noGuildInteraction = {
                ...mockInteraction,
                guild: null,
            } as any;

            await tributeCommand.execute(noGuildInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        });

        it('should reject giving to self', async () => {
            (mockInteraction.options!.getUser as jest.Mock).mockReturnValue({
                id: 'test-user-id', // Same as sender
                username: 'testuser',
                bot: false,
            });

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'One cannot pay tribute to oneself. The desert sees all.',
                ephemeral: true,
            });
        });

        it('should reject giving to a bot', async () => {
            (mockInteraction.options!.getUser as jest.Mock).mockReturnValue({
                id: 'bot-user-id',
                username: 'botuser',
                bot: true,
            });

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Machines have no use for spice.',
                ephemeral: true,
            });
        });

        it('should reject if sender has insufficient balance', async () => {
            const senderBalance = {
                current_balance: 30, // Less than 50
                lifetime_given: 0,
                update: jest.fn(),
            };

            mockSpiceBalance.findOne.mockResolvedValue(senderBalance);

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('insufficient'),
                ephemeral: true,
            });
        });

        it('should reject if sender has no balance record', async () => {
            mockSpiceBalance.findOne.mockResolvedValue(null);

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('0 spice'),
                ephemeral: true,
            });
        });

        it('should successfully transfer spice', async () => {
            const senderBalance = {
                current_balance: 100,
                lifetime_given: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            const recipientBalance = {
                current_balance: 20,
                lifetime_received: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOne.mockResolvedValue(senderBalance);
            mockSpiceBalance.findOrCreate.mockResolvedValue([recipientBalance, false]);

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(senderBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 50, // 100 - 50
                    lifetime_given: 50,
                }),
                expect.any(Object),
            );

            expect(recipientBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 70, // 20 + 50
                    lifetime_received: 50,
                }),
                expect.any(Object),
            );

            expect(mockSpiceLedger.create).toHaveBeenCalledTimes(2);
            expect(mockTransaction.commit).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('50 spice'),
            });
        });

        it('should create recipient balance if not exists', async () => {
            const senderBalance = {
                current_balance: 100,
                lifetime_given: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            const newRecipientBalance = {
                current_balance: 0,
                lifetime_received: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOne.mockResolvedValue(senderBalance);
            mockSpiceBalance.findOrCreate.mockResolvedValue([newRecipientBalance, true]); // true = newly created

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockSpiceBalance.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { guild_id: 'test-guild-id', discord_id: 'target-user-id' },
                    defaults: expect.objectContaining({
                        current_balance: 0,
                    }),
                }),
            );
        });

        it('should record ledger entries for both sender and recipient', async () => {
            const senderBalance = {
                current_balance: 100,
                lifetime_given: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            const recipientBalance = {
                current_balance: 20,
                lifetime_received: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOne.mockResolvedValue(senderBalance);
            mockSpiceBalance.findOrCreate.mockResolvedValue([recipientBalance, false]);

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            // Check sender ledger entry
            expect(mockSpiceLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    discord_id: 'test-user-id',
                    type: 'tribute_paid',
                    amount: -50,
                }),
                expect.any(Object),
            );

            // Check recipient ledger entry
            expect(mockSpiceLedger.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    discord_id: 'target-user-id',
                    type: 'tribute_received',
                    amount: 50,
                }),
                expect.any(Object),
            );
        });

        it('should handle database errors gracefully', async () => {
            mockSpiceBalance.findOne.mockRejectedValue(new Error('Database error'));

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockTransaction.rollback).toHaveBeenCalled();
            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while transferring spice.',
                ephemeral: true,
            });
        });

        it('should include "The spice must flow" in success message', async () => {
            const senderBalance = {
                current_balance: 100,
                lifetime_given: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            const recipientBalance = {
                current_balance: 20,
                lifetime_received: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOne.mockResolvedValue(senderBalance);
            mockSpiceBalance.findOrCreate.mockResolvedValue([recipientBalance, false]);

            await tributeCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('The spice must flow'),
            });
        });
    });
});
