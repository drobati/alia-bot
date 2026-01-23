import { ChatInputCommandInteraction } from 'discord.js';
import harvestCommand from './harvest';
import { Context } from '../utils/types';

describe('Harvest Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockContext: Context;
    let mockSpiceBalance: any;
    let mockSpiceLedger: any;

    beforeEach(() => {
        mockInteraction = {
            options: {
                getBoolean: jest.fn().mockReturnValue(false),
            } as any,
            user: {
                id: 'test-user-id',
                username: 'testuser',
            } as any,
            guild: {
                id: 'test-guild-id',
            } as any,
            reply: jest.fn().mockResolvedValue(undefined),
        } as any;

        mockSpiceBalance = {
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
        } as any;

        jest.clearAllMocks();
    });

    describe('Command Definition', () => {
        it('should have correct name and description', () => {
            expect(harvestCommand.data.name).toBe('harvest');
            expect(harvestCommand.data.description).toBe('Harvest spice from the desert (once per hour)');
        });

        it('should have public option', () => {
            const commandData = harvestCommand.data.toJSON();
            const publicOption = commandData.options?.find((opt: any) => opt.name === 'public');
            expect(publicOption).toBeDefined();
            expect(publicOption?.type).toBe(5); // Boolean type
        });
    });

    describe('Execute Function', () => {
        it('should reject if not in a guild', async () => {
            const noGuildInteraction = {
                ...mockInteraction,
                guild: null,
            } as any;

            await harvestCommand.execute(noGuildInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        });

        it('should harvest spice for first time user', async () => {
            const mockBalance = {
                current_balance: 0,
                last_harvest_at: null,
                lifetime_harvested: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, true]);

            await harvestCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockBalance.update).toHaveBeenCalled();
            expect(mockSpiceLedger.create).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('10 spice'),
                    ephemeral: true,
                }),
            );
        });

        it('should show cooldown message if harvested too recently', async () => {
            const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
            const mockBalance = {
                current_balance: 10,
                last_harvest_at: recentTime,
                lifetime_harvested: 10,
                update: jest.fn(),
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);

            await harvestCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockBalance.update).not.toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('harvest again in'),
                    ephemeral: true,
                }),
            );
        });

        it('should accumulate spice for multiple hours', async () => {
            const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
            const mockBalance = {
                current_balance: 10,
                last_harvest_at: oldTime,
                lifetime_harvested: 10,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);

            await harvestCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 40, // 10 + (3 * 10)
                }),
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('30 spice'),
                }),
            );
        });

        it('should cap accumulation at 24 hours', async () => {
            const veryOldTime = new Date(Date.now() - 48 * 60 * 60 * 1000); // 48 hours ago
            const mockBalance = {
                current_balance: 0,
                last_harvest_at: veryOldTime,
                lifetime_harvested: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);

            await harvestCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockBalance.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    current_balance: 240, // Max 24 hours * 10 spice
                }),
            );
        });

        it('should make reply public when public option is true', async () => {
            (mockInteraction.options!.getBoolean as jest.Mock).mockReturnValue(true);
            const mockBalance = {
                current_balance: 0,
                last_harvest_at: null,
                lifetime_harvested: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, true]);

            await harvestCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    ephemeral: false,
                }),
            );
        });

        it('should handle database errors gracefully', async () => {
            mockSpiceBalance.findOrCreate.mockRejectedValue(new Error('Database error'));

            await harvestCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while harvesting spice.',
                ephemeral: true,
            });
        });

        it('should show different flavor text for large harvests', async () => {
            const veryOldTime = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
            const mockBalance = {
                current_balance: 0,
                last_harvest_at: veryOldTime,
                lifetime_harvested: 0,
                update: jest.fn().mockResolvedValue({}),
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);

            await harvestCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Shai-Hulud'),
                }),
            );
        });
    });
});
