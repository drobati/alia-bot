import { Message } from 'discord.js';
import assistantResponse from './assistant';
import { Context } from '../utils/types';

// Mock the dependencies
jest.mock('../utils/assistant');
jest.mock('../utils/hybrid-classifier');

// Mock OpenAI at the module level to prevent instantiation errors
jest.mock('openai', () => {
    return {
        __esModule: true,
        default: jest.fn().mockImplementation(() => ({
            chat: {
                completions: {
                    create: jest.fn(),
                },
            },
        })),
    };
});

describe('Assistant Response Layer Filtering', () => {
    let mockMessage: Partial<Message>;
    let mockContext: Context;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

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
        } as any;

        mockContext = {
            log: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn(),
            },
        } as any;
    });

    describe('Layer 1: Direct Addressing Pre-filter', () => {
        it('should skip processing messages not directed at bot', async () => {
            mockMessage.content = 'Today\'s accountability challenge, read one Chapter in a book.';

            await assistantResponse(mockMessage as Message, mockContext);

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

            await assistantResponse(mockMessage as Message, mockContext);

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

            await assistantResponse(mockMessage as Message, mockContext);

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

                await assistantResponse(mockMessage as Message, mockContext);

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

                await assistantResponse(mockMessage as Message, mockContext);

                expect(mockContext.log.info).toHaveBeenCalledWith(
                    'Assistant processing directly addressed message',
                    expect.objectContaining({
                        stage: 'direct_addressing_passed',
                    }),
                );
            });
        });
    });
});