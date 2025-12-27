import { createContext, createInteraction } from '../utils/testHelpers';
import profile from './profile';

describe('commands/profile', () => {
    let interaction: any;
    let context: any;
    let mockEngagementService: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockEngagementService = {
            getUserStats: jest.fn(),
        };

        const baseInteraction = createInteraction();
        interaction = {
            ...baseInteraction,
            options: {
                ...baseInteraction.options,
                getUser: jest.fn().mockReturnValue(null),
                getBoolean: jest.fn().mockReturnValue(false),
            },
            guild: {
                id: 'test-guild-id',
                members: {
                    fetch: jest.fn().mockResolvedValue({
                        roles: {
                            cache: new Map([
                                ['role-1', { name: 'Admin', position: 10, toString: () => '<@&role-1>' }],
                                ['everyone', { name: '@everyone', position: 0, toString: () => '@everyone' }],
                            ]),
                        },
                    }),
                },
            },
            user: {
                id: 'test-user-id',
                username: 'TestUser',
                displayAvatarURL: jest.fn().mockReturnValue('https://example.com/avatar.png'),
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
            expect(profile.data.name).toBe('profile');
            expect(profile.data.description).toBe("View your or another user's engagement profile");
        });
    });

    describe('Execute - Own Profile', () => {
        it('should call engagement service with correct parameters', async () => {
            mockEngagementService.getUserStats.mockResolvedValue({
                userId: 'test-user-id',
                username: 'TestUser',
                messageCount: 500,
                commandCount: 100,
                lastActive: new Date(),
                firstSeen: new Date('2024-01-01'),
                rank: 3,
            });

            await profile.execute(interaction, context);

            expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(mockEngagementService.getUserStats).toHaveBeenCalledWith(
                'test-guild-id',
                'test-user-id',
            );
        });

        it('should handle no engagement data for self', async () => {
            mockEngagementService.getUserStats.mockResolvedValue(null);

            await profile.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith({
                content: "You don't have any engagement data yet. Start chatting to build your profile!",
            });
        });
    });

    describe('Execute - Other User Profile', () => {
        it('should query stats for target user', async () => {
            const targetUser = {
                id: 'target-user-id',
                username: 'TargetUser',
                displayAvatarURL: jest.fn().mockReturnValue('https://example.com/target.png'),
            };
            interaction.options.getUser.mockReturnValue(targetUser);

            mockEngagementService.getUserStats.mockResolvedValue({
                userId: 'target-user-id',
                username: 'TargetUser',
                messageCount: 1000,
                commandCount: 200,
                lastActive: new Date(),
                firstSeen: new Date('2023-06-01'),
                rank: 1,
            });

            await profile.execute(interaction, context);

            expect(mockEngagementService.getUserStats).toHaveBeenCalledWith(
                'test-guild-id',
                'target-user-id',
            );
        });

        it('should handle no engagement data for other user', async () => {
            const targetUser = {
                id: 'target-user-id',
                username: 'TargetUser',
                displayAvatarURL: jest.fn().mockReturnValue('https://example.com/target.png'),
            };
            interaction.options.getUser.mockReturnValue(targetUser);
            mockEngagementService.getUserStats.mockResolvedValue(null);

            await profile.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith({
                content: "TargetUser doesn't have any engagement data yet.",
            });
        });
    });

    describe('Edge Cases', () => {
        it('should handle missing guild', async () => {
            interaction.guild = null;

            await profile.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
            });
        });

        it('should handle missing engagement service', async () => {
            context.engagementService = null;

            await profile.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'Engagement tracking is not available.',
            });
        });

        it('should handle public visibility option', async () => {
            interaction.options.getBoolean.mockReturnValue(true);
            mockEngagementService.getUserStats.mockResolvedValue(null);

            await profile.execute(interaction, context);

            expect(interaction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
        });
    });

    describe('Error Handling', () => {
        it('should handle errors gracefully', async () => {
            interaction.deferred = true;
            const error = new Error('Database error');
            mockEngagementService.getUserStats.mockRejectedValue(error);

            await profile.execute(interaction, context);

            expect(context.log.error).toHaveBeenCalled();
            expect(interaction.editReply).toHaveBeenCalledWith({
                content: 'Failed to load profile. Please try again later.',
            });
        });
    });
});
