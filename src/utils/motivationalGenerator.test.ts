import { generateMotivationalMessage, MotivationalRateLimiter } from './motivationalGenerator';
import { Context } from './types';

// Mock OpenAI module completely
jest.mock('openai', () => {
    const mockCreate = jest.fn();
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: mockCreate,
                },
            },
        })),
        mockCreate,
    };
});

// eslint-disable-next-line @typescript-eslint/no-var-requires
const { mockCreate } = require('openai');

// Mock completion object
const mockCompletion = {
    choices: [
        {
            message: {
                content: 'Stay strong and keep pushing forward! 💪',
            },
            finish_reason: 'stop',
        },
    ],
    usage: {
        total_tokens: 50,
        prompt_tokens: 30,
        completion_tokens: 20,
    },
    id: 'test-completion-id',
    model: 'gpt-4-turbo-preview',
    created: Date.now(),
};

const mockContext: Context = {
    log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
    } as any,
    tables: {} as any,
    sequelize: {} as any,
    VERSION: '2.0.0',
    COMMIT_SHA: 'test123',
};

describe('motivationalGenerator', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockCreate.mockResolvedValue(mockCompletion);
        process.env.ASSISTANT_DEBUG = 'false';
    });

    describe('generateMotivationalMessage', () => {
        it('should generate a motivational message successfully', async () => {
            const options = {
                category: 'motivation' as const,
                frequency: 'daily' as const,
            };

            const result = await generateMotivationalMessage(options, mockContext as Context);

            expect(result).toBe('Stay strong and keep pushing forward! 💪');
            expect(mockCreate).toHaveBeenCalledWith({
                model: 'gpt-4-turbo-preview',
                messages: [
                    {
                        role: 'system',
                        content: expect.stringContaining('You are Alia, a motivational Discord bot'),
                    },
                    {
                        role: 'user',
                        content: 'Generate a motivation motivational message for daily delivery.',
                    },
                ],
                max_tokens: 250,
                temperature: 0.8,
            });
        });

        it('should log generation process', async () => {
            const options = {
                category: 'productivity' as const,
                frequency: 'weekly' as const,
            };

            await generateMotivationalMessage(options, mockContext as Context);

            expect(mockContext.log!.info).toHaveBeenCalledWith(
                'Generating motivational message',
                expect.objectContaining({
                    category: 'productivity',
                    frequency: 'weekly',
                }),
            );

            expect(mockContext.log!.info).toHaveBeenCalledWith(
                'Motivational message generated successfully',
                expect.objectContaining({
                    category: 'productivity',
                    frequency: 'weekly',
                    success: true,
                }),
            );
        });

        it('should handle OpenAI API errors gracefully', async () => {
            const error = new Error('API Error');
            (error as any).code = 'rate_limit_exceeded';
            mockCreate.mockRejectedValueOnce(error);

            const options = {
                category: 'general' as const,
                frequency: 'daily' as const,
            };

            const result = await generateMotivationalMessage(options, mockContext as Context);

            expect(result).toBeNull();
            expect(mockContext.log!.warn).toHaveBeenCalledWith(
                'OpenAI API rate limit exceeded during motivational message generation',
                expect.objectContaining({
                    errorCode: 'rate_limit_exceeded',
                    success: false,
                }),
            );
        });

        it('should create different system prompts for different categories', async () => {
            const productivityOptions = {
                category: 'productivity' as const,
                frequency: 'daily' as const,
            };

            await generateMotivationalMessage(productivityOptions, mockContext as Context);

            const productivityCall = mockCreate.mock.calls[0][0];
            expect(productivityCall.messages[0].content).toContain('getting things done');
            expect(productivityCall.messages[0].content).toContain('time management');

            jest.clearAllMocks();

            const motivationOptions = {
                category: 'motivation' as const,
                frequency: 'weekly' as const,
            };

            await generateMotivationalMessage(motivationOptions, mockContext as Context);

            const motivationCall = mockCreate.mock.calls[0][0];
            expect(motivationCall.messages[0].content).toContain('personal growth');
            expect(motivationCall.messages[0].content).toContain('weekly');
        });
    });

    describe('MotivationalRateLimiter', () => {
        beforeEach(() => {
            // Clear the internal state
            (MotivationalRateLimiter as any).lastMessageTimes.clear();
        });

        it('should allow first message in a channel', () => {
            const channelId = '123456789';
            expect(MotivationalRateLimiter.canSendMessage(channelId)).toBe(true);
        });

        it('should prevent messages within rate limit window', () => {
            const channelId = '123456789';

            MotivationalRateLimiter.markMessageSent(channelId);
            expect(MotivationalRateLimiter.canSendMessage(channelId)).toBe(false);
        });

        it('should allow messages after rate limit window', () => {
            const channelId = '123456789';

            // Mock time to be in the past
            const pastTime = Date.now() - (2 * 60 * 1000); // 2 minutes ago
            (MotivationalRateLimiter as any).lastMessageTimes.set(channelId, pastTime);

            expect(MotivationalRateLimiter.canSendMessage(channelId)).toBe(true);
        });

        it('should clean up old entries', () => {
            const channelId1 = '123456789';
            const channelId2 = '987654321';

            // Set one timestamp to old (should be cleaned up)
            const oldTime = Date.now() - (2 * 60 * 60 * 1000); // 2 hours ago
            (MotivationalRateLimiter as any).lastMessageTimes.set(channelId1, oldTime);

            // Set one timestamp to recent (should remain)
            const recentTime = Date.now() - (30 * 60 * 1000); // 30 minutes ago
            (MotivationalRateLimiter as any).lastMessageTimes.set(channelId2, recentTime);

            MotivationalRateLimiter.cleanup();

            const internalMap = (MotivationalRateLimiter as any).lastMessageTimes;
            expect(internalMap.has(channelId1)).toBe(false);
            expect(internalMap.has(channelId2)).toBe(true);
        });
    });
});