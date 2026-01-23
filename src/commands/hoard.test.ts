import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import hoardCommand from './hoard';
import { Context } from '../utils/types';

describe('Hoard Command', () => {
    let mockInteraction: Partial<ChatInputCommandInteraction>;
    let mockContext: Context;
    let mockSpiceBalance: any;

    beforeEach(() => {
        mockInteraction = {
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
            findAll: jest.fn(),
        };

        mockContext = {
            tables: {
                SpiceBalance: mockSpiceBalance,
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
            expect(hoardCommand.data.name).toBe('hoard');
            expect(hoardCommand.data.description).toBe('View the greatest spice hoarders of Arrakis');
        });
    });

    describe('Execute Function', () => {
        it('should reject if not in a guild', async () => {
            const noGuildInteraction = {
                ...mockInteraction,
                guild: null,
            } as any;

            await hoardCommand.execute(noGuildInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        });

        it('should show message when no users have harvested', async () => {
            mockSpiceBalance.findAll.mockResolvedValue([]);

            await hoardCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('No one has harvested spice yet'),
                ephemeral: false,
            });
        });

        it('should display leaderboard with top users', async () => {
            const mockUsers = [
                { discord_id: 'user1', username: 'Emperor', current_balance: 1000 },
                { discord_id: 'user2', username: 'Baron', current_balance: 500 },
                { discord_id: 'test-user-id', username: 'testuser', current_balance: 100 },
            ];

            mockSpiceBalance.findAll.mockResolvedValue(mockUsers);

            await hoardCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.any(EmbedBuilder),
                ]),
            });
        });

        it('should highlight current user in leaderboard', async () => {
            const mockUsers = [
                { discord_id: 'user1', username: 'Emperor', current_balance: 1000 },
                { discord_id: 'test-user-id', username: 'testuser', current_balance: 500 },
            ];

            mockSpiceBalance.findAll.mockResolvedValue(mockUsers);

            await hoardCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const description = embed.data.description;

            expect(description).toContain('**(You)**');
        });

        it('should show user rank in footer when not in top 10', async () => {
            const mockTopUsers = Array.from({ length: 10 }, (_, i) => ({
                discord_id: `user${i}`,
                username: `User${i}`,
                current_balance: 1000 - i * 50,
            }));

            const mockAllUsers = [
                ...mockTopUsers,
                { discord_id: 'test-user-id', username: 'testuser', current_balance: 10 },
            ];

            // First call returns top 10, second call returns all
            mockSpiceBalance.findAll
                .mockResolvedValueOnce(mockTopUsers)
                .mockResolvedValueOnce(mockAllUsers);

            await hoardCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];

            expect(embed.data.footer.text).toContain('#11');
        });

        it('should display Dune-themed rank titles', async () => {
            const mockUsers = [
                { discord_id: 'user1', username: 'TopUser', current_balance: 1000 },
                { discord_id: 'user2', username: 'SecondUser', current_balance: 900 },
                { discord_id: 'user3', username: 'ThirdUser', current_balance: 800 },
            ];

            mockSpiceBalance.findAll.mockResolvedValue(mockUsers);

            await hoardCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const description = embed.data.description;

            expect(description).toContain('Emperor');
            expect(description).toContain('Kwisatz Haderach');
            expect(description).toContain('Naib');
        });

        it('should handle database errors gracefully', async () => {
            mockSpiceBalance.findAll.mockRejectedValue(new Error('Database error'));

            await hoardCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while consulting the spice records.',
                ephemeral: true,
            });
        });

        it('should handle users with null usernames', async () => {
            const mockUsers = [
                { discord_id: 'user1', username: null, current_balance: 1000 },
            ];

            mockSpiceBalance.findAll.mockResolvedValue(mockUsers);

            await hoardCommand.execute(mockInteraction as ChatInputCommandInteraction, mockContext);

            const replyCall = (mockInteraction.reply as jest.Mock).mock.calls[0][0];
            const embed = replyCall.embeds[0];
            const description = embed.data.description;

            expect(description).toContain('Unknown User');
        });
    });
});
