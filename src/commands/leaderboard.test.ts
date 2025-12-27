import { createContext, createInteraction } from '../utils/testHelpers';
import leaderboard from './leaderboard';

describe('commands/leaderboard', () => {
    let interaction: any;
    let context: any;
    let mockEngagementService: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockEngagementService = {
            getLeaderboard: jest.fn(),
            getUserStats: jest.fn(),
        };

        const baseInteraction = createInteraction();
        interaction = {
            ...baseInteraction,
            options: {
                ...baseInteraction.options,
                getString: jest.fn().mockReturnValue('messages'),
                getInteger: jest.fn().mockReturnValue(10),
                getBoolean: jest.fn().mockReturnValue(false),
            },
            guild: {
                id: 'test-guild-id',
                name: 'Test Guild',
                iconURL: jest.fn().mockReturnValue('https://example.com/icon.png'),
            },
            user: {
                id: 'test-user-id',
            },
            deferReply: jest.fn().mockResolvedValue(undefined),
            editReply: jest.fn().mockResolvedValue(undefined),
            reply: jest.fn().mockResolvedValue(undefined),
            deferred: false,
        };

        context = {
            ...createContext(),
            engagementService: mockEngagementService,
        };
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(leaderboard.data.name).toBe('leaderboard');
            expect(leaderboard.data.description).toBe('Display server engagement leaderboard');
        });
    });

    describe('Execute', () => {
        it('should display leaderboard successfully', async () => {
            mockEngagementService.getLeaderboard.mockResolvedValue([
                {
                    userId: 'user-1',
                    username: 'TopUser',
                    messageCount: 100,
                    commandCount: 50,
                    lastActive: new Date(),
                },
                {
                    userId: 'user-2',
                    username: 'SecondUser',
                    messageCount: 75,
                    commandCount: 30,
                    lastActive: new Date(),
                },
            ]);
            mockEngagementService.getUserStats.mockResolvedValue({ rank: 5 });

            await leaderboard.execute(interaction, context);

            expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(mockEngagementService.getLeaderboard).toHaveBeenCalledWith('test-guild-id', 10);
            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    embeds: expect.any(Array),
                }),
            );
        });

        it('should handle empty leaderboard', async () => {
            mockEngagementService.getLeaderboard.mockResolvedValue([]);

            await leaderboard.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'No engagement data available yet. Start chatting to build the leaderboard!',
            });
        });

        it('should handle missing guild', async () => {
            interaction.guild = null;

            await leaderboard.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
            });
        });

        it('should handle missing engagement service', async () => {
            context.engagementService = null;

            await leaderboard.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'Engagement tracking is not available.',
            });
        });

        it('should show user rank when not in top list', async () => {
            mockEngagementService.getLeaderboard.mockResolvedValue([
                {
                    userId: 'user-1',
                    username: 'TopUser',
                    messageCount: 100,
                    commandCount: 50,
                    lastActive: new Date(),
                },
            ]);
            mockEngagementService.getUserStats.mockResolvedValue({
                rank: 15,
                messageCount: 50,
                commandCount: 25,
            });

            await leaderboard.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalled();
            const callArgs = interaction.editReply.mock.calls[0][0];
            expect(callArgs.embeds).toBeDefined();
        });

        it('should sort by commands when specified', async () => {
            interaction.options.getString.mockReturnValue('commands');

            mockEngagementService.getLeaderboard.mockResolvedValue([
                {
                    userId: 'user-1',
                    username: 'TopCommands',
                    messageCount: 50,
                    commandCount: 100,
                    lastActive: new Date(),
                },
            ]);
            mockEngagementService.getUserStats.mockResolvedValue({ rank: 1 });

            await leaderboard.execute(interaction, context);

            const callArgs = interaction.editReply.mock.calls[0][0];
            expect(callArgs.embeds[0].data.description).toContain('command usage');
        });

        it('should handle public visibility option', async () => {
            interaction.options.getBoolean.mockReturnValue(true);

            mockEngagementService.getLeaderboard.mockResolvedValue([
                {
                    userId: 'user-1',
                    username: 'User',
                    messageCount: 100,
                    commandCount: 50,
                    lastActive: new Date(),
                },
            ]);
            mockEngagementService.getUserStats.mockResolvedValue({ rank: 1 });

            await leaderboard.execute(interaction, context);

            expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            interaction.deferred = true;
            const error = new Error('Database error');
            mockEngagementService.getLeaderboard.mockRejectedValue(error);

            await leaderboard.execute(interaction, context);

            expect(context.log.error).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'Failed to generate leaderboard. Please try again later.',
            });
        });
    });
});
