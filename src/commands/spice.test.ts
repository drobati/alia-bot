import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import spiceCommand from './spice';
import { Context } from '../utils/types';

describe('Spice Command', () => {
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
                displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
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
            findAll: jest.fn().mockResolvedValue([]),
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
            expect(spiceCommand.data.name).toBe('spice');
            expect(spiceCommand.data.description).toBe('Check your spice balance');
        });

        it('should have public option', () => {
            const commandData = spiceCommand.data.toJSON();
            const publicOption = commandData.options?.find((opt: any) => opt.name === 'public');
            expect(publicOption).toBeDefined();
        });
    });

    describe('Execute Function', () => {
        it('should reject if not in a guild', async () => {
            const noGuildInteraction = {
                ...mockInteraction,
                guild: null,
            } as any;

            await spiceCommand.execute(noGuildInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        });

        it('should display balance for new user', async () => {
            const mockBalance = {
                current_balance: 0,
                last_harvest_at: null,
                lifetime_harvested: 0,
                lifetime_given: 0,
                lifetime_received: 0,
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, true]);

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([expect.any(EmbedBuilder)]),
                ephemeral: true,
            });
        });

        it('should show cooldown time when harvest is on cooldown', async () => {
            const recentTime = new Date(Date.now() - 30 * 60 * 1000); // 30 mins ago
            const mockBalance = {
                current_balance: 100,
                last_harvest_at: recentTime,
                lifetime_harvested: 100,
                lifetime_given: 10,
                lifetime_received: 5,
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const desertStatusField = embed.data.fields.find((f: any) => f.name === 'Desert Status');

            expect(desertStatusField.value).toContain('min');
            expect(desertStatusField.value).toContain('until harvest');
        });

        it('should show accumulated spice when harvest is ready', async () => {
            const oldTime = new Date(Date.now() - 3 * 60 * 60 * 1000); // 3 hours ago
            const mockBalance = {
                current_balance: 100,
                last_harvest_at: oldTime,
                lifetime_harvested: 100,
                lifetime_given: 10,
                lifetime_received: 5,
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const desertStatusField = embed.data.fields.find((f: any) => f.name === 'Desert Status');

            expect(desertStatusField.value).toContain('30 spice');
            expect(desertStatusField.value).toContain('accumulated');
        });

        it('should display recent transactions', async () => {
            const mockBalance = {
                current_balance: 100,
                last_harvest_at: null,
                lifetime_harvested: 100,
                lifetime_given: 0,
                lifetime_received: 0,
            };

            const mockTransactions = [
                { type: 'harvest', amount: 10, description: 'Desert harvest', created_at: new Date() },
                { type: 'tribute_paid', amount: -5, description: 'Tribute to User', created_at: new Date() },
            ];

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);
            mockSpiceLedger.findAll.mockResolvedValue(mockTransactions);

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const activityField = embed.data.fields.find((f: any) => f.name === 'Recent Activity');

            expect(activityField).toBeDefined();
            expect(activityField.value).toContain('+10');
        });

        it('should make reply public when public option is true', async () => {
            (mockInteraction.options!.getBoolean as jest.Mock).mockReturnValue(true);
            const mockBalance = {
                current_balance: 0,
                last_harvest_at: null,
                lifetime_harvested: 0,
                lifetime_given: 0,
                lifetime_received: 0,
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, true]);

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    ephemeral: false,
                }),
            );
        });

        it('should handle database errors gracefully', async () => {
            mockSpiceBalance.findOrCreate.mockRejectedValue(new Error('Database error'));

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while checking your balance.',
                ephemeral: true,
            });
        });

        it('should show desert awaits for first time user', async () => {
            const mockBalance = {
                current_balance: 0,
                last_harvest_at: null,
                lifetime_harvested: 0,
                lifetime_given: 0,
                lifetime_received: 0,
            };

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, true]);

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const desertStatusField = embed.data.fields.find((f: any) => f.name === 'Desert Status');

            expect(desertStatusField.value).toBe('The desert awaits!');
        });

        it('should display correct emoji for different transaction types', async () => {
            const mockBalance = {
                current_balance: 100,
                last_harvest_at: null,
                lifetime_harvested: 100,
                lifetime_given: 0,
                lifetime_received: 0,
            };

            const mockTransactions = [
                { type: 'harvest', amount: 10, description: 'Desert harvest', created_at: new Date() },
                { type: 'tribute_received', amount: 5, description: 'Tribute from User', created_at: new Date() },
            ];

            mockSpiceBalance.findOrCreate.mockResolvedValue([mockBalance, false]);
            mockSpiceLedger.findAll.mockResolvedValue(mockTransactions);

            await spiceCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const activityField = embed.data.fields.find((f: any) => f.name === 'Recent Activity');

            expect(activityField.value).toContain('🏜️'); // harvest emoji
            expect(activityField.value).toContain('📥'); // tribute received emoji
        });
    });
});
