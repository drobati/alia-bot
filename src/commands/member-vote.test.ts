import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockMemberVotingConfig = {
    findOne: jest.fn<any>(),
    upsert: jest.fn<any>(),
    update: jest.fn<any>(),
};

const mockMemberVote = {
    findOne: jest.fn<any>(),
    findAll: jest.fn<any>(),
    count: jest.fn<any>(),
    update: jest.fn<any>(),
};

const mockContext = {
    tables: {
        MemberVotingConfig: mockMemberVotingConfig,
        MemberVote: mockMemberVote,
    },
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const mockVotingChannel = {
    id: 'voting-channel-id',
    permissionsFor: jest.fn<any>().mockReturnValue({
        has: jest.fn<any>().mockReturnValue(true),
    }),
};

const mockApprovedRole = {
    id: 'approved-role-id',
    position: 1,
};

const mockBotMember = {
    roles: {
        highest: { position: 10 },
    },
};

const mockGuildMember = {
    roles: {
        add: jest.fn<any>(),
    },
};

const mockGuildRoles = {
    fetch: jest.fn<any>().mockResolvedValue(mockApprovedRole),
};

const mockGuildChannels = {
    fetch: jest.fn<any>().mockResolvedValue(mockVotingChannel),
};

const mockGuild = {
    channels: mockGuildChannels,
    roles: mockGuildRoles,
    members: {
        me: mockBotMember,
        fetch: jest.fn<any>().mockResolvedValue(mockGuildMember),
    },
};

const mockInteraction = {
    options: {
        getSubcommand: jest.fn<any>(),
        getChannel: jest.fn<any>(),
        getRole: jest.fn<any>(),
        getInteger: jest.fn<any>(),
        getString: jest.fn<any>(),
    },
    reply: jest.fn<any>(),
    followUp: jest.fn<any>(),
    user: {
        id: '145679133257498624', // Match owner ID
        username: 'testuser',
    },
    guild: mockGuild,
    guildId: 'test-guild-id',
    replied: false,
    deferred: false,
};

// Mock the permissions module
jest.mock('../utils/permissions', () => ({
    checkOwnerPermission: jest.fn<any>().mockResolvedValue(undefined),
    isOwner: jest.fn<any>().mockReturnValue(true),
}));

describe('Member Vote Command', () => {
    let memberVoteCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        mockInteraction.reply.mockResolvedValue({ id: 'reply-message-id' });
        mockMemberVotingConfig.upsert.mockResolvedValue([{}, true]);

        // Import after mocking
        memberVoteCommand = (await import('./member-vote')).default;
    });

    describe('Setup Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('setup');
            mockInteraction.options.getChannel.mockImplementation((param: string) => {
                switch (param) {
                    case 'voting_channel':
                        return mockVotingChannel;
                    case 'welcome_channel':
                        return null;
                    default:
                        return null;
                }
            });
            mockInteraction.options.getRole.mockReturnValue(mockApprovedRole);
            mockInteraction.options.getInteger.mockImplementation((param: string) => {
                switch (param) {
                    case 'votes_required':
                        return 3;
                    case 'duration_hours':
                        return 24;
                    default:
                        return null;
                }
            });
        });

        it('should configure member voting successfully', async () => {
            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockMemberVotingConfig.upsert).toHaveBeenCalledWith({
                guild_id: 'test-guild-id',
                voting_channel_id: 'voting-channel-id',
                approved_role_id: 'approved-role-id',
                votes_required: 3,
                vote_duration_hours: 24,
                welcome_channel_id: null,
                enabled: false,
            });

            const callArgs = mockInteraction.reply.mock.calls[0][0] as any;
            expect(callArgs.embeds).toBeDefined();
            expect(callArgs.embeds[0].data?.title).toBe('Member Voting System Configured');
        });

        it('should reject if bot lacks channel permissions', async () => {
            mockVotingChannel.permissionsFor.mockReturnValue({
                has: jest.fn<any>().mockReturnValue(false),
            });

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("don't have permission"),
                ephemeral: true,
            });
            expect(mockMemberVotingConfig.upsert).not.toHaveBeenCalled();
        });

        it('should reject if role is higher than bot role', async () => {
            mockVotingChannel.permissionsFor.mockReturnValue({
                has: jest.fn<any>().mockReturnValue(true),
            });

            const highRole = { id: 'high-role-id', position: 15 };
            mockInteraction.options.getRole.mockReturnValue(highRole);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('cannot assign the role'),
                ephemeral: true,
            });
            expect(mockMemberVotingConfig.upsert).not.toHaveBeenCalled();
        });
    });

    describe('Enable Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('enable');
        });

        it('should enable member voting when configured', async () => {
            mockMemberVotingConfig.findOne.mockResolvedValue({
                guild_id: 'test-guild-id',
                enabled: false,
            });
            mockMemberVotingConfig.update.mockResolvedValue([1]);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockMemberVotingConfig.update).toHaveBeenCalledWith(
                { enabled: true },
                { where: { guild_id: 'test-guild-id' } },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('enabled'),
                ephemeral: false,
            });
        });

        it('should reject if not configured', async () => {
            mockMemberVotingConfig.findOne.mockResolvedValue(null);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('not been configured'),
                ephemeral: true,
            });
            expect(mockMemberVotingConfig.update).not.toHaveBeenCalled();
        });

        it('should notify if already enabled', async () => {
            mockMemberVotingConfig.findOne.mockResolvedValue({
                guild_id: 'test-guild-id',
                enabled: true,
            });

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Member voting is already enabled.',
                ephemeral: true,
            });
            expect(mockMemberVotingConfig.update).not.toHaveBeenCalled();
        });
    });

    describe('Disable Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('disable');
        });

        it('should disable member voting', async () => {
            mockMemberVotingConfig.findOne.mockResolvedValue({
                guild_id: 'test-guild-id',
                enabled: true,
            });
            mockMemberVotingConfig.update.mockResolvedValue([1]);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockMemberVotingConfig.update).toHaveBeenCalledWith(
                { enabled: false },
                { where: { guild_id: 'test-guild-id' } },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('disabled'),
                ephemeral: false,
            });
        });
    });

    describe('Status Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('status');
        });

        it('should show configuration status', async () => {
            mockMemberVotingConfig.findOne.mockResolvedValue({
                guild_id: 'test-guild-id',
                voting_channel_id: 'voting-channel-id',
                approved_role_id: 'approved-role-id',
                votes_required: 3,
                vote_duration_hours: 24,
                welcome_channel_id: null,
                enabled: true,
            });
            mockMemberVote.count.mockResolvedValue(2);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            const callArgs = mockInteraction.reply.mock.calls[0][0] as any;
            expect(callArgs.embeds).toBeDefined();
            expect(callArgs.embeds[0].data?.title).toBe('Member Voting Configuration');
            expect(callArgs.ephemeral).toBe(true);
        });

        it('should notify if not configured', async () => {
            mockMemberVotingConfig.findOne.mockResolvedValue(null);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('not been configured'),
                ephemeral: true,
            });
        });
    });

    describe('Pending Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('pending');
        });

        it('should list pending votes', async () => {
            const mockPendingVotes = [
                {
                    vote_id: 'abc12345',
                    member_id: 'member-1',
                    member_username: 'TestUser#1234',
                    approve_voters: ['voter1'],
                    reject_voters: [],
                    expires_at: new Date(Date.now() + 86400000),
                },
            ];

            mockMemberVote.findAll.mockResolvedValue(mockPendingVotes);
            mockMemberVotingConfig.findOne.mockResolvedValue({
                votes_required: 3,
            });

            await memberVoteCommand.execute(mockInteraction, mockContext);

            const callArgs = mockInteraction.reply.mock.calls[0][0] as any;
            expect(callArgs.embeds).toBeDefined();
            expect(callArgs.embeds[0].data?.title).toBe('Pending Member Votes');
        });

        it('should handle no pending votes', async () => {
            mockMemberVote.findAll.mockResolvedValue([]);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'There are no pending member votes.',
                ephemeral: true,
            });
        });
    });

    describe('Approve Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('approve');
            mockInteraction.options.getString.mockReturnValue('test-vote-id');
        });

        it('should manually approve a pending vote', async () => {
            mockMemberVote.findOne.mockResolvedValue({
                id: 1,
                vote_id: 'test-vote-id',
                member_id: 'member-123',
                member_username: 'TestUser#1234',
                status: 'pending',
            });
            mockMemberVotingConfig.findOne.mockResolvedValue({
                approved_role_id: 'approved-role-id',
            });
            mockMemberVote.update.mockResolvedValue([1]);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockMemberVote.update).toHaveBeenCalledWith(
                {
                    status: 'approved',
                    resolved_at: expect.any(Date),
                },
                { where: { id: 1 } },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('manually approved'),
                ephemeral: false,
            });
        });

        it('should handle non-existent vote', async () => {
            mockMemberVote.findOne.mockResolvedValue(null);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Vote not found or already resolved.',
                ephemeral: true,
            });
        });
    });

    describe('Reject Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('reject');
            mockInteraction.options.getString.mockReturnValue('test-vote-id');
        });

        it('should manually reject a pending vote', async () => {
            mockMemberVote.findOne.mockResolvedValue({
                id: 1,
                vote_id: 'test-vote-id',
                member_id: 'member-123',
                member_username: 'TestUser#1234',
                status: 'pending',
            });
            mockMemberVote.update.mockResolvedValue([1]);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockMemberVote.update).toHaveBeenCalledWith(
                {
                    status: 'rejected',
                    resolved_at: expect.any(Date),
                },
                { where: { id: 1 } },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('manually rejected'),
                ephemeral: false,
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('status');
            const error = new Error('Database connection failed');
            mockMemberVotingConfig.findOne.mockRejectedValue(error);

            await memberVoteCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Error executing member-vote command',
                expect.objectContaining({
                    error,
                    subcommand: 'status',
                }),
            );

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while executing the command.',
                ephemeral: true,
            });
        });
    });
});
