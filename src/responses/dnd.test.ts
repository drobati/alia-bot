import dndResponseHandler from './dnd';
import { DndGameAttributes } from '../types/database';
import { safelySendToChannel } from '../utils/discordHelpers';
import OpenAI from 'openai';

// Mock dependencies
jest.mock('../utils/discordHelpers');
jest.mock('openai');

// Use fake timers
jest.useFakeTimers();

describe('DnD Response Handler', () => {
    let mockMessage: any;
    let mockContext: any;
    let mockDndGameModel: any;
    let mockChannel: any;
    let mockClient: any;
    const mockSafelySendToChannel = safelySendToChannel as jest.MockedFunction<typeof safelySendToChannel>;

    beforeEach(() => {
        jest.clearAllMocks();
        jest.clearAllTimers();

        // Mock channel
        mockChannel = {
            id: 'test-channel-id',
            send: jest.fn().mockResolvedValue(undefined),
            isTextBased: jest.fn().mockReturnValue(true),
        };

        // Mock client
        mockClient = {
            channels: {
                fetch: jest.fn().mockResolvedValue(mockChannel),
            },
        };

        // Mock DndGame model
        mockDndGameModel = {
            findOne: jest.fn(),
            update: jest.fn().mockResolvedValue([1]),
        };

        // Mock message
        mockMessage = {
            author: {
                bot: false,
                id: 'user-123',
                username: 'TestPlayer',
            },
            guildId: 'guild-123',
            channelId: 'channel-123',
            content: 'I attack the goblin!',
            client: mockClient,
        };

        // Mock context
        mockContext = {
            tables: {
                DndGame: mockDndGameModel,
            },
            log: {
                info: jest.fn(),
                error: jest.fn(),
                debug: jest.fn(),
            },
            sequelize: {},
            client: mockClient,
        };

        // Mock safelySendToChannel
        mockSafelySendToChannel.mockResolvedValue(true);
    });

    afterEach(() => {
        jest.clearAllTimers();
    });

    describe('message filtering', () => {
        it('should ignore bot messages', async () => {
            mockMessage.author.bot = true;

            const result = await dndResponseHandler(mockMessage, mockContext);

            expect(result).toBe(false);
            expect(mockDndGameModel.findOne).not.toHaveBeenCalled();
        });

        it('should ignore messages not in a guild', async () => {
            mockMessage.guildId = null;

            const result = await dndResponseHandler(mockMessage, mockContext);

            expect(result).toBe(false);
            expect(mockDndGameModel.findOne).not.toHaveBeenCalled();
        });

        it('should ignore messages in channels without active games', async () => {
            mockDndGameModel.findOne.mockResolvedValue(null);

            const result = await dndResponseHandler(mockMessage, mockContext);

            expect(mockDndGameModel.findOne).toHaveBeenCalledWith({
                where: {
                    guildId: 'guild-123',
                    channelId: 'channel-123',
                    isActive: true,
                },
            });
            expect(result).toBe(false);
        });
    });

    describe('message collection', () => {
        let mockGame: Partial<DndGameAttributes>;

        beforeEach(() => {
            mockGame = {
                id: 1,
                guildId: 'guild-123',
                channelId: 'channel-123',
                name: 'Test Campaign',
                isActive: true,
                waitPeriodMinutes: 5,
                currentRound: 1,
                pendingMessages: [],
                conversationHistory: [],
                systemPrompt: 'You are a DM',
            };
            mockDndGameModel.findOne.mockResolvedValue(mockGame);
        });

        it('should collect a message and start timer', async () => {
            const result = await dndResponseHandler(mockMessage, mockContext);

            expect(result).toBe(true);
            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                {
                    pendingMessages: [
                        {
                            userId: 'user-123',
                            username: 'TestPlayer',
                            content: 'I attack the goblin!',
                            timestamp: expect.any(Date),
                        },
                    ],
                },
                { where: { id: 1 } },
            );
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'D&D message collected',
                expect.objectContaining({
                    gameId: 1,
                    gameName: 'Test Campaign',
                    pendingCount: 1,
                    waitTimeMinutes: 5,
                }),
            );
        });

        it('should append to existing pending messages', async () => {
            mockGame.pendingMessages = [
                {
                    userId: 'user-456',
                    username: 'OtherPlayer',
                    content: 'I defend!',
                    timestamp: new Date(),
                },
            ];
            mockDndGameModel.findOne.mockResolvedValue(mockGame);

            await dndResponseHandler(mockMessage, mockContext);

            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                {
                    pendingMessages: [
                        mockGame.pendingMessages[0],
                        {
                            userId: 'user-123',
                            username: 'TestPlayer',
                            content: 'I attack the goblin!',
                            timestamp: expect.any(Date),
                        },
                    ],
                },
                { where: { id: 1 } },
            );
        });

        it('should reset timer when new message arrives', async () => {
            // First message
            await dndResponseHandler(mockMessage, mockContext);

            // Advance time but not enough to trigger
            jest.advanceTimersByTime(2 * 60 * 1000); // 2 minutes

            // Second message should reset timer
            mockMessage.content = 'I cast fireball!';
            mockGame.pendingMessages = [
                {
                    userId: 'user-123',
                    username: 'TestPlayer',
                    content: 'I attack the goblin!',
                    timestamp: new Date(),
                },
            ];
            mockDndGameModel.findOne.mockResolvedValue(mockGame);

            await dndResponseHandler(mockMessage, mockContext);

            // Should have 2 pending messages now
            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                {
                    pendingMessages: expect.arrayContaining([
                        expect.objectContaining({ content: 'I attack the goblin!' }),
                        expect.objectContaining({ content: 'I cast fireball!' }),
                    ]),
                },
                { where: { id: 1 } },
            );
        });
    });

    describe('message processing after wait period', () => {
        let mockGame: Partial<DndGameAttributes>;

        beforeEach(() => {
            mockGame = {
                id: 1,
                guildId: 'guild-123',
                channelId: 'channel-123',
                name: 'Test Campaign',
                isActive: true,
                waitPeriodMinutes: 5,
                currentRound: 1,
                pendingMessages: [
                    {
                        userId: 'user-123',
                        username: 'Player1',
                        content: 'I attack!',
                        timestamp: new Date(),
                    },
                    {
                        userId: 'user-456',
                        username: 'Player2',
                        content: 'I defend!',
                        timestamp: new Date(),
                    },
                ],
                conversationHistory: [],
                systemPrompt: 'You are a DM',
            };
        });

        it('should process messages after wait period', async () => {
            mockDndGameModel.findOne
                .mockResolvedValueOnce(mockGame) // Initial findOne for message collection
                .mockResolvedValueOnce(mockGame); // Second findOne for processing

            // Mock OpenAI
            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{
                                message: {
                                    content: 'The goblin falls! Victory is yours!',
                                },
                            }],
                            usage: {
                                total_tokens: 100,
                                prompt_tokens: 50,
                                completion_tokens: 50,
                            },
                        }),
                    },
                },
            } as any));

            // Collect message
            await dndResponseHandler(mockMessage, mockContext);

            // Fast-forward past wait period
            await jest.runAllTimersAsync();

            // Should have called OpenAI with formatted messages
            const MockedOpenAIClass = jest.mocked(OpenAI);
            const openaiInstance = MockedOpenAIClass.mock.results[0].value;
            expect(openaiInstance.chat.completions.create).toHaveBeenCalledWith({
                model: 'gpt-4-turbo-preview',
                messages: [
                    { role: 'system', content: 'You are a DM' },
                    { role: 'user', content: 'Player1: I attack!\nPlayer2: I defend!' },
                ],
                max_tokens: 500,
                temperature: 0.8,
            });

            // Should have updated game state
            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    currentRound: 2,
                    pendingMessages: [],
                    conversationHistory: expect.arrayContaining([
                        { role: 'user', content: 'Player1: I attack!\nPlayer2: I defend!' },
                        { role: 'assistant', content: 'The goblin falls! Victory is yours!' },
                    ]),
                }),
                { where: { id: 1 } },
            );

            // Should have sent message to channel
            expect(mockSafelySendToChannel).toHaveBeenCalledWith(
                expect.anything(),
                '🎲 **Test Campaign** (Round 2)\n\nThe goblin falls! Victory is yours!',
                mockContext,
                'D&D response',
            );
        });

        it('should include conversation history in OpenAI request', async () => {
            mockGame.conversationHistory = [
                { role: 'user', content: 'Previous action' },
                { role: 'assistant', content: 'Previous response' },
            ];
            mockDndGameModel.findOne
                .mockResolvedValueOnce(mockGame)
                .mockResolvedValueOnce(mockGame);

            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Response' } }],
                            usage: { total_tokens: 100 },
                        }),
                    },
                },
            } as any));

            await dndResponseHandler(mockMessage, mockContext);
            await jest.runAllTimersAsync();

            const MockedOpenAIClass = jest.mocked(OpenAI);
            const openaiInstance = MockedOpenAIClass.mock.results[0].value;
            expect(openaiInstance.chat.completions.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    messages: expect.arrayContaining([
                        { role: 'system', content: 'You are a DM' },
                        { role: 'user', content: 'Previous action' },
                        { role: 'assistant', content: 'Previous response' },
                        { role: 'user', content: expect.any(String) },
                    ]),
                }),
            );
        });

        it('should trim conversation history to last 20 messages', async () => {
            // Create 25 messages in history (should trim to 20)
            mockGame.conversationHistory = Array.from({ length: 25 }, (_, i) => ({
                role: i % 2 === 0 ? 'user' : 'assistant',
                content: `Message ${i}`,
            })) as any;

            mockDndGameModel.findOne
                .mockResolvedValueOnce(mockGame)
                .mockResolvedValueOnce(mockGame);

            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Response' } }],
                            usage: { total_tokens: 100 },
                        }),
                    },
                },
            } as any));

            await dndResponseHandler(mockMessage, mockContext);
            await jest.runAllTimersAsync();

            // Verify trimmed history (25 old + 2 new = 27, trimmed to last 20)
            expect(mockDndGameModel.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    conversationHistory: expect.arrayContaining([
                        expect.objectContaining({ content: expect.any(String) }),
                    ]),
                }),
                { where: { id: 1 } },
            );

            const updateCall = mockDndGameModel.update.mock.calls.find(
                (call: any) => call[0].conversationHistory !== undefined,
            );
            expect(updateCall[0].conversationHistory.length).toBe(20);
        });

        it('should handle empty pending messages', async () => {
            mockGame.pendingMessages = [];
            mockDndGameModel.findOne.mockResolvedValue(mockGame);

            await dndResponseHandler(mockMessage, mockContext);
            await jest.runAllTimersAsync();

            // Should not process if no messages
            const MockedOpenAI = jest.mocked(OpenAI);
            expect(MockedOpenAI).not.toHaveBeenCalled();
        });
    });

    describe('error handling', () => {
        it('should handle database errors during collection', async () => {
            mockDndGameModel.findOne.mockRejectedValue(new Error('Database error'));

            const result = await dndResponseHandler(mockMessage, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'D&D response handler error',
                expect.objectContaining({
                    error: expect.any(Error),
                }),
            );
        });

        it('should handle OpenAI API errors', async () => {
            const mockGame: Partial<DndGameAttributes> = {
                id: 1,
                guildId: 'guild-123',
                channelId: 'channel-123',
                name: 'Test Campaign',
                isActive: true,
                waitPeriodMinutes: 5,
                pendingMessages: [
                    {
                        userId: 'user-123',
                        username: 'Player1',
                        content: 'I attack!',
                        timestamp: new Date(),
                    },
                ],
                conversationHistory: [],
                systemPrompt: 'You are a DM',
            };

            mockDndGameModel.findOne
                .mockResolvedValueOnce(mockGame)
                .mockResolvedValueOnce(mockGame);

            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockRejectedValue(new Error('OpenAI API error')),
                    },
                },
            } as any));

            await dndResponseHandler(mockMessage, mockContext);
            await jest.runAllTimersAsync();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Error processing D&D messages',
                expect.objectContaining({
                    error: expect.any(Error),
                    gameId: 1,
                }),
            );
        });

        it('should handle channel fetch errors', async () => {
            const mockGame: Partial<DndGameAttributes> = {
                id: 1,
                guildId: 'guild-123',
                channelId: 'channel-123',
                name: 'Test Campaign',
                isActive: true,
                waitPeriodMinutes: 5,
                pendingMessages: [
                    {
                        userId: 'user-123',
                        username: 'Player1',
                        content: 'I attack!',
                        timestamp: new Date(),
                    },
                ],
                conversationHistory: [],
                systemPrompt: 'You are a DM',
            };

            mockDndGameModel.findOne
                .mockResolvedValueOnce(mockGame)
                .mockResolvedValueOnce(mockGame);

            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Response' } }],
                            usage: { total_tokens: 100 },
                        }),
                    },
                },
            } as any));

            mockClient.channels.fetch.mockRejectedValue(new Error('Channel not found'));

            await dndResponseHandler(mockMessage, mockContext);
            await jest.runAllTimersAsync();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Error fetching D&D channel',
                expect.objectContaining({
                    error: expect.any(Error),
                    gameId: 1,
                    channelId: 'channel-123',
                }),
            );
        });

        it('should handle missing client in context', async () => {
            mockContext.client = undefined;

            const mockGame: Partial<DndGameAttributes> = {
                id: 1,
                guildId: 'guild-123',
                channelId: 'channel-123',
                name: 'Test Campaign',
                isActive: true,
                waitPeriodMinutes: 5,
                pendingMessages: [
                    {
                        userId: 'user-123',
                        username: 'Player1',
                        content: 'I attack!',
                        timestamp: new Date(),
                    },
                ],
                conversationHistory: [],
                systemPrompt: 'You are a DM',
            };

            mockDndGameModel.findOne
                .mockResolvedValueOnce(mockGame)
                .mockResolvedValueOnce(mockGame);

            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Response' } }],
                            usage: { total_tokens: 100 },
                        }),
                    },
                },
            } as any));

            await dndResponseHandler(mockMessage, mockContext);
            await jest.runAllTimersAsync();

            // Should not throw, just skip sending message
            expect(mockSafelySendToChannel).not.toHaveBeenCalled();
        });
    });

    describe('logging', () => {
        it('should log message received', async () => {
            const mockGame: Partial<DndGameAttributes> = {
                id: 1,
                guildId: 'guild-123',
                channelId: 'channel-123',
                name: 'Test Campaign',
                isActive: true,
                waitPeriodMinutes: 5,
                pendingMessages: [],
                systemPrompt: 'You are a DM',
            };
            mockDndGameModel.findOne.mockResolvedValue(mockGame);

            await dndResponseHandler(mockMessage, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'D&D message received',
                {
                    gameId: 1,
                    gameName: 'Test Campaign',
                    userId: 'user-123',
                    username: 'TestPlayer',
                    messageLength: mockMessage.content.length,
                },
            );
        });

        it('should log message processing start', async () => {
            const mockGame: Partial<DndGameAttributes> = {
                id: 1,
                guildId: 'guild-123',
                channelId: 'channel-123',
                name: 'Test Campaign',
                isActive: true,
                waitPeriodMinutes: 5,
                pendingMessages: [
                    {
                        userId: 'user-123',
                        username: 'Player1',
                        content: 'I attack!',
                        timestamp: new Date(),
                    },
                ],
                conversationHistory: [],
                systemPrompt: 'You are a DM',
            };

            mockDndGameModel.findOne
                .mockResolvedValueOnce(mockGame)
                .mockResolvedValueOnce(mockGame);

            const MockedOpenAI = jest.mocked(OpenAI);
            MockedOpenAI.mockImplementation(() => ({
                chat: {
                    completions: {
                        create: jest.fn().mockResolvedValue({
                            choices: [{ message: { content: 'Response' } }],
                            usage: { total_tokens: 100 },
                        }),
                    },
                },
            } as any));

            await dndResponseHandler(mockMessage, mockContext);
            await jest.runAllTimersAsync();

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Processing collected D&D messages',
                expect.objectContaining({
                    gameId: 1,
                    gameName: 'Test Campaign',
                    messageCount: 1,
                }),
            );
        });
    });
});
