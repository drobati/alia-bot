import { Message } from 'discord.js';
import { Context } from '../utils/types';

// Mock the dependencies BEFORE importing the module that uses them
jest.mock('../utils/assistant');
jest.mock('../utils/discordHelpers');

import assistantResponse from './assistant';
import generateResponse from '../utils/assistant';
import { safelySendToChannel } from '../utils/discordHelpers';

// Mock openai SDK (used by OpenRouter client) to prevent instantiation errors
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
const mockSafelySendToChannel = safelySendToChannel as jest.MockedFunction<typeof safelySendToChannel>;

describe('Assistant Response System', () => {
    let mockMessage: Partial<Message>;
    let mockContext: Context;
    let mockChannel: any;

    beforeEach(() => {
        jest.clearAllMocks();

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

        mockGenerateResponse.mockResolvedValue('This is a sassy response');
        mockSafelySendToChannel.mockResolvedValue(true);
    });

    describe('Bot Message Filtering', () => {
        it('should skip messages from bots', async () => {
            mockMessage.author!.bot = true;
            mockMessage.content = 'Alia, what is 2+2?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
        });
    });

    describe('Direct Addressing', () => {
        it('should skip messages not directed at bot', async () => {
            mockMessage.content = 'Today\'s accountability challenge, read one Chapter in a book.';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
        });

        it('should skip unclear statements not directed at bot', async () => {
            mockMessage.content = 'HE IS WHITE AND NONESENSE';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
        });

        it('should respond to messages that start with "Alia,"', async () => {
            mockMessage.content = 'Alia, what is the capital of South Africa?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).toHaveBeenCalled();
        });

        it('should respond to messages that mention the bot', async () => {
            mockMessage.content = 'Hey @Alia what is photosynthesis?';
            (mockMessage.mentions!.has as jest.Mock).mockReturnValue(true);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).toHaveBeenCalled();
        });

        it('should skip empty content after prefix removal', async () => {
            mockMessage.content = 'Alia,';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
        });
    });

    describe('Always Responds When Addressed', () => {
        it('should respond to insults (no content filter)', async () => {
            mockMessage.content = 'Alia, you are stupid';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).toHaveBeenCalled();
        });

        it('should respond to personal requests', async () => {
            mockMessage.content = 'Alia, tell John he should come';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).toHaveBeenCalled();
        });

        it('should respond to any question', async () => {
            mockMessage.content = 'Alia, what is the meaning of life?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).toHaveBeenCalled();
        });

        it('should respond to non-questions', async () => {
            mockMessage.content = 'Alia, you look nice today';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).toHaveBeenCalled();
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
                'This is a sassy response',
                mockContext,
                'assistant response',
            );
        });

        it('should handle failed response sending', async () => {
            mockSafelySendToChannel.mockResolvedValue(false);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Assistant failed to send response',
                expect.objectContaining({
                    userId: 'test-user-id',
                }),
            );
        });

        it('should handle null response from generator', async () => {
            mockGenerateResponse.mockResolvedValue(null);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
        });

        it('should handle missing channel', async () => {
            const messageWithNoChannel = {
                ...mockMessage,
                channel: null,
            };

            const result = await assistantResponse(messageWithNoChannel as unknown as Message, mockContext);

            expect(result).toBe(false);
        });
    });

    describe('Error Handling', () => {
        beforeEach(() => {
            mockMessage.content = 'Alia, what is machine learning?';
        });

        it('should handle response generation errors', async () => {
            const responseError = new Error('API failed');
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

        it('should handle mentions without prefix removal', async () => {
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

    describe('Integration - Messages Not Directed at Bot', () => {
        const problemExamples = [
            'Today\'s accountability challenge, read one Chapter in a book.',
            'I guess her server time is England.',
            'HE IS WHITE AND NONESENSE',
            'I\'m thinking that the reason why you might think your hand looks deformed...',
        ];

        problemExamples.forEach((example) => {
            it(`should NOT process: "${example.substring(0, 40)}..."`, async () => {
                mockMessage.content = example;

                const result = await assistantResponse(mockMessage as Message, mockContext);

                expect(result).toBe(false);
            });
        });
    });
});
