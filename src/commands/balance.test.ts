import { createContext, createInteraction } from "../utils/testHelpers";
import balanceCommand from "./balance";

describe('commands/balance', () => {
    let interaction: any;
    let context: any;
    let mockSparksService: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();

        // Add guild to interaction
        interaction.guild = {
            id: 'test-guild-id',
            members: {
                fetch: jest.fn().mockResolvedValue({
                    permissions: {
                        has: jest.fn().mockReturnValue(false),
                    },
                }),
            },
        };
        interaction.guildId = 'test-guild-id';
        interaction.user = {
            id: 'fake-user-id',
            username: 'testuser',
            displayAvatarURL: jest.fn().mockReturnValue('http://example.com/avatar.png'),
        };

        // Mock sparks service
        mockSparksService = {
            getOrCreateUser: jest.fn().mockResolvedValue({ id: 1 }),
            getBalance: jest.fn().mockResolvedValue({
                currentBalance: 150,
                escrowBalance: 0,
                lifetimeEarned: 150,
                lifetimeSpent: 0,
                availableBalance: 150,
            }),
            getRecentTransactions: jest.fn().mockResolvedValue([
                { type: 'earn', amount: 1, description: 'Message', createdAt: new Date() },
                { type: 'daily_bonus', amount: 3, description: 'Daily bonus', createdAt: new Date() },
            ]),
        };
        context.sparksService = mockSparksService;
    });

    describe('command data', () => {
        it('should have correct name and description', () => {
            expect(balanceCommand.data.name).toBe('balance');
            expect(balanceCommand.data.description).toContain('balance');
        });
    });

    describe('execute', () => {
        it('should reject if not in a guild', async () => {
            interaction.guild = null;

            await balanceCommand.execute(interaction as any, context as any);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
        });

        it('should reject if sparks service is not available', async () => {
            context.sparksService = undefined;

            await balanceCommand.execute(interaction as any, context as any);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('not available'),
                ephemeral: true,
            });
        });

        it('should show own balance when no user specified', async () => {
            interaction.options.getUser = jest.fn().mockReturnValue(null);

            await balanceCommand.execute(interaction as any, context as any);

            expect(mockSparksService.getOrCreateUser).toHaveBeenCalledWith(
                'test-guild-id',
                'fake-user-id',
                'testuser',
            );
            expect(mockSparksService.getBalance).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith({
                embeds: expect.any(Array),
                ephemeral: true,
            });
        });

        it('should show balance embed with correct fields', async () => {
            interaction.options.getUser = jest.fn().mockReturnValue(null);

            await balanceCommand.execute(interaction as any, context as any);

            const replyCall = interaction.reply.mock.calls[0][0];
            expect(replyCall.embeds).toHaveLength(1);
            const embed = replyCall.embeds[0];
            expect(embed.data.title).toContain('Balance');
        });

        it('should reject non-moderator checking other user', async () => {
            const targetUser = { id: 'other-user-id', username: 'otheruser' };
            interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
            interaction.user = { id: 'fake-user-id', username: 'testuser' } as any;

            await balanceCommand.execute(interaction as any, context as any);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('moderator permissions'),
                ephemeral: true,
            });
        });

        it('should allow moderator to check other user balance', async () => {
            const targetUser = {
                id: 'other-user-id',
                username: 'otheruser',
                displayAvatarURL: jest.fn().mockReturnValue('http://example.com/avatar.png'),
            };
            interaction.options.getUser = jest.fn().mockReturnValue(targetUser);
            interaction.user = { id: 'fake-user-id', username: 'testuser' } as any;
            interaction.guild.members.fetch = jest.fn().mockResolvedValue({
                permissions: {
                    has: jest.fn().mockReturnValue(true),
                },
            });

            await balanceCommand.execute(interaction as any, context as any);

            expect(mockSparksService.getOrCreateUser).toHaveBeenCalledWith(
                'test-guild-id',
                'other-user-id',
                'otheruser',
            );
            expect(interaction.reply).toHaveBeenCalledWith({
                embeds: expect.any(Array),
                ephemeral: true,
            });
        });

        it('should handle balance not found', async () => {
            interaction.options.getUser = jest.fn().mockReturnValue(null);
            mockSparksService.getBalance.mockResolvedValue(null);

            await balanceCommand.execute(interaction as any, context as any);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Could not retrieve balance'),
                ephemeral: true,
            });
        });

        it('should handle errors gracefully', async () => {
            interaction.options.getUser = jest.fn().mockReturnValue(null);
            mockSparksService.getBalance.mockRejectedValue(new Error('DB error'));

            await balanceCommand.execute(interaction as any, context as any);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('error occurred'),
                ephemeral: true,
            });
            expect(context.log.error).toHaveBeenCalled();
        });

        it('should include recent transactions in embed', async () => {
            interaction.options.getUser = jest.fn().mockReturnValue(null);

            await balanceCommand.execute(interaction as any, context as any);

            expect(mockSparksService.getRecentTransactions).toHaveBeenCalledWith(
                'test-guild-id',
                'fake-user-id',
                5,
            );
        });
    });
});
