import { Message } from 'discord.js';
import assistantResponse from './assistant';
import generateResponse from '../utils/assistant';
import { HybridClassifier } from '../utils/hybrid-classifier';
import { safelySendToChannel } from '../utils/discordHelpers';
import { Context } from '../utils/types';

// Mock the dependencies
jest.mock('../utils/assistant');
jest.mock('../utils/hybrid-classifier');
jest.mock('../utils/discordHelpers');

// Mock OpenAI at the module level to prevent instantiation errors
jest.mock('openai', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        chat: {
            completions: {
                create: jest.fn(),
            },
        },
    })),
}));

const mockGenerateResponse = generateResponse as jest.MockedFunction<typeof generateResponse>;
const MockHybridClassifier = HybridClassifier as jest.MockedClass<typeof HybridClassifier>;
const mockSafelySendToChannel = safelySendToChannel as jest.MockedFunction<typeof safelySendToChannel>;

describe('Assistant Response System', () => {
    let mockMessage: Partial<Message>;
    let mockContext: Context;
    let mockClassifier: any;
    let mockChannel: any;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Setup mock channel
        mockChannel = {
            send: jest.fn().mockResolvedValue({ id: 'message-123' }),
        };

        mockMessage = {
            author: {
                bot: false,
                id: 'test-user-id',
                username: 'testuser',
            },
            content: '',
            mentions: {
                has: jest.fn().mockReturnValue(false),
            },
            client: {
                user: { id: 'bot-user-id' },
            },
            channelId: 'test-channel-id',
            channel: mockChannel,
        } as any;

        mockContext = {
            log: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
        } as any;

        // Setup mock classifier
        mockClassifier = {
            classify: jest.fn().mockReturnValue({
                intent: 'general-knowledge',
                confidence: 0.8,
                method: 'keyword',
            }),
            getDetailedClassification: jest.fn().mockReturnValue({
                allScores: { 'general-knowledge': 0.8 },
                keywordMatches: ['what', 'how'],
                bayesianScore: 0.7,
            }),
        };
        MockHybridClassifier.mockImplementation(() => mockClassifier);

        // Setup default mocks
        mockGenerateResponse.mockResolvedValue('This is a helpful response');
        mockSafelySendToChannel.mockResolvedValue(true);
    });

    describe('Bot Message Filtering', () => {
        it('should skip messages from bots', async () => {
            mockMessage.author!.bot = true;
            mockMessage.content = 'Alia, what is 2+2?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.debug).not.toHaveBeenCalled();
        });
    });

    describe('Layer 1: Direct Addressing Pre-filter', () => {
        it('should skip processing messages not directed at bot', async () => {
            mockMessage.content = 'Today\'s accountability challenge, read one Chapter in a book.';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                'Assistant skipped - not directly addressed',
                expect.objectContaining({
                    stage: 'direct_addressing_filter',
                    botMentioned: false,
                    startsWithAlia: false,
                }),
            );
        });

        it('should skip processing unclear statements not directed at bot', async () => {
            mockMessage.content = 'HE IS WHITE AND NONESENSE';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                'Assistant skipped - not directly addressed',
                expect.objectContaining({
                    stage: 'direct_addressing_filter',
                }),
            );
        });

        it('should process messages that start with "Alia,"', async () => {
            mockMessage.content = 'Alia, what is the capital of South Africa?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant processing directly addressed message',
                expect.objectContaining({
                    stage: 'direct_addressing_passed',
                    startsWithAlia: true,
                }),
            );
        });

        it('should process messages that mention the bot', async () => {
            mockMessage.content = 'Hey @Alia what is photosynthesis?';
            (mockMessage.mentions!.has as jest.Mock).mockReturnValue(true);

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant processing directly addressed message',
                expect.objectContaining({
                    stage: 'direct_addressing_passed',
                    botMentioned: true,
                }),
            );
        });
    });

    describe('Layer 2: Content Appropriateness Filtering', () => {
        beforeEach(() => {
            // Setup message to pass Layer 1
            mockMessage.content = 'Alia, ';
        });

        it('should skip empty content after prefix removal', async () => {
            mockMessage.content = 'Alia,';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                'Assistant skipped - no meaningful content after prefix removal',
                expect.objectContaining({
                    stage: 'content_validation_filter',
                }),
            );
        });

        it('should process appropriate general knowledge questions', async () => {
            mockMessage.content = 'Alia, what is photosynthesis?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant processing directly addressed message',
                expect.objectContaining({
                    stage: 'direct_addressing_passed',
                }),
            );
        });

        const inappropriateExamples = [
            'Alia, you are stupid',
            'Alia, you suck at this',
            'Alia, shut up',
            'Alia, fuck this',
            'Alia, this is shit',
            'Alia, damn you',
            'Alia, I hate you',
        ];

        inappropriateExamples.forEach(example => {
            it(`should filter inappropriate content: "${example}"`, async () => {
                mockMessage.content = example;

                // Mock classifier to return a result that would normally proceed to content check
                mockClassifier.classify.mockReturnValue({
                    intent: 'general-knowledge',
                    confidence: 0.8,
                    method: 'keyword',
                });

                const result = await assistantResponse(mockMessage as Message, mockContext);

                expect(result).toBe(false);
                expect(mockContext.log.info).toHaveBeenCalledWith(
                    'Assistant skipped - inappropriate content detected',
                    expect.objectContaining({
                        stage: 'content_appropriateness_filter',
                    }),
                );
            });
        });

        const personalPatterns = [
            'Alia, tell John he should come',
            'Alia, my hand hurts',
            'Alia, my back aches badly',
            'Alia, I think that he is wrong',
            'Alia, you should tell them',
            'Alia, can you tell Sarah about this',
        ];

        personalPatterns.forEach(example => {
            it(`should filter personal/social requests: "${example}"`, async () => {
                mockMessage.content = example;

                // Mock classifier to return a result that would normally proceed to content check
                mockClassifier.classify.mockReturnValue({
                    intent: 'general-knowledge',
                    confidence: 0.8,
                    method: 'keyword',
                });

                const result = await assistantResponse(mockMessage as Message, mockContext);

                expect(result).toBe(false);
                expect(mockContext.log.info).toHaveBeenCalledWith(
                    'Assistant skipped - inappropriate content detected',
                    expect.objectContaining({
                        stage: 'content_appropriateness_filter',
                    }),
                );
            });
        });

        it('should allow appropriate educational content', async () => {
            mockMessage.content = 'Alia, what is photosynthesis?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).not.toHaveBeenCalledWith(
                'Assistant skipped - inappropriate content detected',
                expect.anything(),
            );
        });
    });

    describe('Classification and Confidence Thresholds', () => {
        beforeEach(() => {
            mockMessage.content = 'Alia, what is photosynthesis?';
        });

        it('should process messages above confidence threshold', async () => {
            mockClassifier.classify.mockReturnValue({
                intent: 'general-knowledge',
                confidence: 0.85,
                method: 'keyword',
            });

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant threshold met, processing intent',
                expect.objectContaining({
                    confidence: 0.85,
                    willProcess: true,
                }),
            );
        });

        it('should skip messages below confidence threshold', async () => {
            mockClassifier.classify.mockReturnValue({
                intent: 'general-knowledge',
                confidence: 0.5,
                method: 'bayesian',
            });

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant confidence below threshold, no response',
                expect.objectContaining({
                    confidence: 0.5,
                    confidenceThreshold: 0.7,
                    stage: 'confidence_filtered',
                }),
            );
        });

        it('should skip messages with non-response intents', async () => {
            mockClassifier.classify.mockReturnValue({
                intent: 'social-chat',
                confidence: 0.9,
                method: 'keyword',
            });

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant classified message but not as general-knowledge',
                expect.objectContaining({
                    intent: 'social-chat',
                    confidence: 0.9,
                    stage: 'intent_filtered',
                }),
            );
        });

        const responseIntents = ['general-knowledge', 'real-time-knowledge', 'technical-question'];
        responseIntents.forEach(intent => {
            it(`should process ${intent} intent`, async () => {
                mockClassifier.classify.mockReturnValue({
                    intent: intent,
                    confidence: 0.8,
                    method: 'keyword',
                });

                const result = await assistantResponse(mockMessage as Message, mockContext);

                expect(result).toBe(true);
                expect(mockContext.log.info).toHaveBeenCalledWith(
                    'Assistant threshold met, processing intent',
                    expect.objectContaining({
                        intent: intent,
                        willProcess: true,
                    }),
                );
            });
        });
    });

    describe('Debug Mode', () => {
        beforeEach(() => {
            mockMessage.content = 'Alia, what is quantum physics?';
            process.env.ASSISTANT_DEBUG = 'true';
        });

        afterEach(() => {
            delete process.env.ASSISTANT_DEBUG;
        });

        it('should log detailed classification in debug mode', async () => {
            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockClassifier.getDetailedClassification).toHaveBeenCalledWith('what is quantum physics?');
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                'Assistant detailed classification',
                expect.objectContaining({
                    allScores: expect.any(Object),
                    keywordMatches: expect.any(Array),
                }),
            );
        });
    });

    describe('Response Generation and Sending', () => {
        beforeEach(() => {
            mockMessage.content = 'Alia, explain gravity';
        });

        it('should generate and send successful response', async () => {
            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).toHaveBeenCalledWith(
                'explain gravity',
                mockContext,
                {
                    userId: 'test-user-id',
                    username: 'testuser',
                    channelId: 'test-channel-id',
                },
            );
            expect(mockSafelySendToChannel).toHaveBeenCalledWith(
                mockChannel,
                'This is a helpful response',
                mockContext,
                'assistant response',
            );
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant response sent successfully',
                expect.objectContaining({
                    userId: 'test-user-id',
                    responseLength: 25,
                    stage: 'response_sent',
                    success: true,
                }),
            );
        });

        it('should handle failed response sending', async () => {
            mockSafelySendToChannel.mockResolvedValue(false);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Assistant failed to send response to Discord',
                expect.objectContaining({
                    stage: 'discord_send',
                    success: false,
                }),
            );
        });

        it('should handle empty response from generator', async () => {
            mockGenerateResponse.mockResolvedValue('');

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.warn).toHaveBeenCalledWith(
                'Assistant generated no response or channel not available',
                expect.objectContaining({
                    hasResponse: false,
                    stage: 'response_validation',
                    success: false,
                }),
            );
        });

        it('should handle null response from generator', async () => {
            mockGenerateResponse.mockResolvedValue(null);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.warn).toHaveBeenCalledWith(
                'Assistant generated no response or channel not available',
                expect.objectContaining({
                    hasResponse: false,
                }),
            );
        });

        it('should handle missing channel', async () => {
            const messageWithNoChannel = {
                ...mockMessage,
                channel: null,
            };

            const result = await assistantResponse(messageWithNoChannel as unknown as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.warn).toHaveBeenCalledWith(
                'Assistant generated no response or channel not available',
                expect.objectContaining({
                    hasChannel: false,
                }),
            );
        });

        it('should handle channel without send method', async () => {
            const messageWithBadChannel = {
                ...mockMessage,
                channel: { type: 'DM' } as any,
            };

            const result = await assistantResponse(messageWithBadChannel as unknown as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.warn).toHaveBeenCalledWith(
                'Assistant generated no response or channel not available',
                expect.objectContaining({
                    hasChannel: false,
                }),
            );
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            mockMessage.content = 'Alia, what is machine learning?';
        });

        it('should handle classification errors', async () => {
            const classificationError = new Error('Classification failed');
            mockClassifier.classify.mockImplementation(() => {
                throw classificationError;
            });

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Assistant processing error',
                expect.objectContaining({
                    userId: 'test-user-id',
                    error: classificationError,
                    stage: 'classification_error',
                    success: false,
                }),
            );
        });

        it('should handle response generation errors', async () => {
            const responseError = new Error('OpenAI API failed');
            mockGenerateResponse.mockRejectedValue(responseError);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Assistant processing error',
                expect.objectContaining({
                    error: responseError,
                }),
            );
        });

        it('should handle Discord API errors', async () => {
            const discordError = new Error('Discord rate limited');
            mockSafelySendToChannel.mockRejectedValue(discordError);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Assistant processing error',
                expect.anything(),
            );
        });
    });

    describe('Logging and Metrics', () => {
        beforeEach(() => {
            mockMessage.content = 'Alia, how do computers work?';
        });

        it('should log classification metrics', async () => {
            mockClassifier.classify.mockReturnValue({
                intent: 'technical-question',
                confidence: 0.892,
                method: 'bayesian',
            });

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant message classification',
                expect.objectContaining({
                    userId: 'test-user-id',
                    username: 'testuser',
                    channelId: 'test-channel-id',
                    intent: 'technical-question',
                    confidence: 0.892,
                    method: 'bayesian',
                    confidenceThreshold: 0.7,
                    meetsThreshold: true,
                    timestamp: expect.any(String),
                }),
            );
        });

        it('should round confidence to 3 decimals', async () => {
            mockClassifier.classify.mockReturnValue({
                intent: 'general-knowledge',
                confidence: 0.8567891234,
                method: 'keyword',
            });

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant message classification',
                expect.objectContaining({
                    confidence: 0.857,
                }),
            );
        });

        it('should log processing time on success', async () => {
            Date.now();

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant response sent successfully',
                expect.objectContaining({
                    processingTimeMs: expect.any(Number),
                }),
            );
        });

        it('should log processing time on error', async () => {
            mockGenerateResponse.mockRejectedValue(new Error('Test error'));

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Assistant processing error',
                expect.objectContaining({
                    processingTimeMs: expect.any(Number),
                }),
            );
        });
    });

    describe('Integration Test - Previous Problem Examples', () => {
        const problemExamples = [
            'Today\'s accountability challenge, read one Chapter in a book.',
            'I guess her server time is England.',
            'HE IS WHITE AND NONESENSE',
            'I\'m thinking that the reason why you might think your hand looks deformed...',
        ];

        problemExamples.forEach((example, index) => {
            it(`should NOT process problem example ${index + 1}: "${example.substring(0, 30)}..."`, async () => {
                mockMessage.content = example;

                const result = await assistantResponse(mockMessage as Message, mockContext);

                expect(result).toBe(false);
                expect(mockContext.log.debug).toHaveBeenCalledWith(
                    'Assistant skipped - not directly addressed',
                    expect.objectContaining({
                        stage: 'direct_addressing_filter',
                    }),
                );
            });
        });

        const appropriateExamples = [
            'Alia, what is the capital of South Africa?',
            'Alia, explain photosynthesis',
            'Alia, how does gravity work?',
        ];

        appropriateExamples.forEach((example, index) => {
            it(`should process appropriate example ${index + 1}: "${example}"`, async () => {
                mockMessage.content = example;

                const result = await assistantResponse(mockMessage as Message, mockContext);

                expect(result).toBe(true);
                expect(mockContext.log.info).toHaveBeenCalledWith(
                    'Assistant processing directly addressed message',
                    expect.objectContaining({
                        stage: 'direct_addressing_passed',
                    }),
                );
                expect(mockGenerateResponse).toHaveBeenCalled();
                expect(mockSafelySendToChannel).toHaveBeenCalled();
            });
        });
    });

    describe('Prefix Handling', () => {
        it('should handle "Alia," prefix with comma', async () => {
            mockMessage.content = 'Alia, what is DNA?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockGenerateResponse).toHaveBeenCalledWith(
                'what is DNA?',
                mockContext,
                expect.any(Object),
            );
        });

        it('should handle "Alia " prefix without comma', async () => {
            mockMessage.content = 'Alia what is RNA?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockGenerateResponse).toHaveBeenCalledWith(
                'what is RNA?',
                mockContext,
                expect.any(Object),
            );
        });

        it('should be case insensitive for prefix', async () => {
            mockMessage.content = 'alia, what is ATP?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockGenerateResponse).toHaveBeenCalledWith(
                'what is ATP?',
                mockContext,
                expect.any(Object),
            );
        });

        it('should handle mentions without prefix', async () => {
            mockMessage.content = '@Alia what is mitochondria?';
            (mockMessage.mentions!.has as jest.Mock).mockReturnValue(true);

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockGenerateResponse).toHaveBeenCalledWith(
                '@Alia what is mitochondria?',
                mockContext,
                expect.any(Object),
            );
        });
    });
});