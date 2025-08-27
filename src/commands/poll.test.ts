import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockPoll = {
    create: jest.fn<any>(),
    findOne: jest.fn<any>(),
};

const mockPollVote = {
    findAll: jest.fn<any>(),
    count: jest.fn<any>(),
    upsert: jest.fn<any>(),
};

const mockSequelize = {
    fn: jest.fn<any>(),
    col: jest.fn<any>(),
};

const mockContext = {
    tables: {
        Poll: mockPoll,
        PollVote: mockPollVote,
    },
    sequelize: mockSequelize,
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const mockInteraction = {
    options: {
        getSubcommand: jest.fn<any>(),
        getString: jest.fn<any>(),
        getInteger: jest.fn<any>(),
    },
    reply: jest.fn<any>(),
    followUp: jest.fn<any>(),
    user: {
        id: 'test-user-id',
    },
    channelId: 'test-channel-id',
    guildId: 'test-guild-id',
    replied: false,
};

const mockPollMessage = {
    id: 'test-message-id',
    react: jest.fn<any>(),
};

describe('Poll Command', () => {
    let pollCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        mockInteraction.reply.mockResolvedValue(mockPollMessage);
        mockInteraction.options.getSubcommand.mockReturnValue('create');
        mockInteraction.options.getInteger.mockReturnValue(60);
        mockInteraction.options.getString.mockImplementation((param: string) => {
            switch (param) {
                case 'question':
                    return 'Test poll question?';
                case 'options':
                    return 'Option 1, Option 2, Option 3';
                default:
                    return null;
            }
        });

        // Import after mocking
        pollCommand = (await import('./poll')).default;
    });

    describe('Create Subcommand', () => {
        it('should create a poll successfully', async () => {
            await pollCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            title: '📊 Test poll question?',
                        }),
                    }),
                ]),
                fetchReply: true,
            });

            expect(mockPollMessage.react).toHaveBeenCalledTimes(3);
            expect(mockPollMessage.react).toHaveBeenCalledWith('1️⃣');
            expect(mockPollMessage.react).toHaveBeenCalledWith('2️⃣');
            expect(mockPollMessage.react).toHaveBeenCalledWith('3️⃣');

            expect(mockPoll.create).toHaveBeenCalledWith({
                message_id: 'test-message-id',
                channel_id: 'test-channel-id',
                guild_id: 'test-guild-id',
                creator_id: 'test-user-id',
                question: 'Test poll question?',
                options: JSON.stringify(['Option 1', 'Option 2', 'Option 3']),
                expires_at: expect.any(Date),
                is_active: true,
            });
        });

        it('should reject polls with less than 2 options', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                switch (param) {
                    case 'question':
                        return 'Test poll question?';
                    case 'options':
                        return 'Only one option';
                    default:
                        return null;
                }
            });

            await pollCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Please provide at least 2 poll options separated by commas.',
                ephemeral: true,
            });
            expect(mockPoll.create).not.toHaveBeenCalled();
        });

        it('should reject polls with more than 10 options', async () => {
            const elevenOptions = Array.from({ length: 11 }, (_, i) => `Option ${i + 1}`).join(', ');
            mockInteraction.options.getString.mockImplementation((param: string) => {
                switch (param) {
                    case 'question':
                        return 'Test poll question?';
                    case 'options':
                        return elevenOptions;
                    default:
                        return null;
                }
            });

            await pollCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Maximum 10 poll options allowed.',
                ephemeral: true,
            });
            expect(mockPoll.create).not.toHaveBeenCalled();
        });
    });

    describe('Results Subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('results');
            mockInteraction.options.getString.mockImplementation((param: string) => {
                switch (param) {
                    case 'message_id':
                        return 'test-message-id';
                    default:
                        return null;
                }
            });
        });

        it('should show poll results', async () => {
            const mockPollData = {
                id: 1,
                question: 'Test poll question?',
                options: JSON.stringify(['Option 1', 'Option 2', 'Option 3']),
                is_active: true,
                expires_at: new Date(Date.now() + 60000),
                creator_id: 'creator-id',
            };

            const mockVotes = [
                { option_index: 0, count: '5' },
                { option_index: 1, count: '3' },
                { option_index: 2, count: '2' },
            ];

            mockPoll.findOne.mockResolvedValue(mockPollData);
            mockPollVote.findAll.mockResolvedValue(mockVotes);
            mockPollVote.count.mockResolvedValue(10);

            await pollCommand.execute(mockInteraction, mockContext);

            expect(mockPoll.findOne).toHaveBeenCalledWith({
                where: { message_id: 'test-message-id' },
            });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                embeds: expect.arrayContaining([
                    expect.objectContaining({
                        data: expect.objectContaining({
                            title: '📊 Poll Results: Test poll question?',
                        }),
                    }),
                ]),
            });
        });

        it('should handle non-existent polls', async () => {
            mockPoll.findOne.mockResolvedValue(null);

            await pollCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'Poll not found.',
                ephemeral: true,
            });
        });
    });

    describe('Error Handling', () => {
        it('should handle database errors gracefully', async () => {
            const error = new Error('Database connection failed');
            mockPoll.create.mockRejectedValue(error);

            await pollCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Error executing poll command',
                expect.objectContaining({
                    error,
                    subcommand: 'create',
                    userId: 'test-user-id',
                }),
            );

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: 'An error occurred while executing the command.',
                ephemeral: true,
            });
        });
    });
});