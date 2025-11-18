/**
 * Integration tests for the full Assistant Response System
 *
 * These tests verify the complete flow from Discord message to AI response:
 * 1. Message filtering (bot messages, direct addressing)
 * 2. Content appropriateness checking
 * 3. Hybrid classification (keyword + Bayesian)
 * 4. OpenAI API integration
 * 5. Response sending
 *
 * Prerequisites:
 * - OPENAI_API_KEY must be set in environment
 * - Tests will be skipped if API key is not available
 *
 * Run with: npm test assistant.integration.test.ts
 */

import { Message } from 'discord.js';
import assistantResponse from './assistant';
import { Context } from '../utils/types';

// Skip all tests in this file if OPENAI_API_KEY is not set
const describeIfApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key-for-ci'
    ? describe
    : describe.skip;

describeIfApiKey('Assistant Response System Integration Tests', () => {
    let mockMessage: Partial<Message>;
    let mockContext: Context;
    let mockChannel: any;
    let sentMessages: string[];

    beforeEach(() => {
        sentMessages = [];

        // Setup mock channel that captures sent messages
        mockChannel = {
            send: jest.fn().mockImplementation((content: string) => {
                sentMessages.push(content);
                return Promise.resolve({ id: 'message-' + Date.now() });
            }),
        };

        mockMessage = {
            author: {
                bot: false,
                id: 'test-user-integration',
                username: 'integration-tester',
            },
            content: '',
            mentions: {
                has: jest.fn().mockReturnValue(false),
            },
            client: {
                user: { id: 'bot-user-id' },
            },
            channelId: 'test-channel-integration',
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
    });

    describe('End-to-End: Direct Addressed Messages', () => {
        it('should process "Alia," prefix and generate response', async () => {
            mockMessage.content = 'Alia, what is photosynthesis?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            // Should return true (message was handled)
            expect(result).toBe(true);

            // Should have sent a message
            expect(mockChannel.send).toHaveBeenCalled();
            expect(sentMessages.length).toBe(1);

            // Response should be relevant
            const response = sentMessages[0].toLowerCase();
            expect(
                response.includes('plant') ||
                response.includes('light') ||
                response.includes('chlorophyll') ||
                response.includes('energy')
            ).toBe(true);

            // Should log classification
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant message classification',
                expect.objectContaining({
                    intent: 'general-knowledge',
                    meetsThreshold: true,
                })
            );
        }, 30000);

        it('should process bot mention and generate response', async () => {
            mockMessage.content = 'Hey @Alia, what is gravity?';
            (mockMessage.mentions!.has as jest.Mock).mockReturnValue(true);

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            const response = sentMessages[0].toLowerCase();
            expect(
                response.includes('force') ||
                response.includes('mass') ||
                response.includes('attraction')
            ).toBe(true);
        }, 30000);

        it('should handle case-insensitive "alia" prefix', async () => {
            mockMessage.content = 'alia, what is DNA?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            const response = sentMessages[0].toLowerCase();
            expect(
                response.includes('dna') ||
                response.includes('genetic') ||
                response.includes('cell')
            ).toBe(true);
        }, 30000);
    });

    describe('End-to-End: Message Filtering', () => {
        it('should skip bot messages', async () => {
            mockMessage.author!.bot = true;
            mockMessage.content = 'Alia, what is the meaning of life?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(sentMessages.length).toBe(0);
        }, 5000);

        it('should skip messages not addressed to bot', async () => {
            mockMessage.content = 'Today is a beautiful day';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(sentMessages.length).toBe(0);

            expect(mockContext.log.debug).toHaveBeenCalledWith(
                'Assistant skipped - not directly addressed',
                expect.objectContaining({
                    stage: 'direct_addressing_filter',
                })
            );
        }, 5000);

        it('should skip messages with just "Alia," and no content', async () => {
            mockMessage.content = 'Alia,';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(sentMessages.length).toBe(0);
        }, 5000);
    });

    describe('End-to-End: Content Appropriateness', () => {
        it('should filter inappropriate content', async () => {
            mockMessage.content = 'Alia, you are stupid';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(sentMessages.length).toBe(0);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant skipped - inappropriate content detected',
                expect.objectContaining({
                    stage: 'content_appropriateness_filter',
                })
            );
        }, 5000);

        it('should filter personal requests', async () => {
            mockMessage.content = 'Alia, tell John he should come here';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(sentMessages.length).toBe(0);
        }, 5000);

        it('should process appropriate educational questions', async () => {
            mockMessage.content = 'Alia, what is the speed of light?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            const response = sentMessages[0].toLowerCase();
            expect(
                response.includes('meter') ||
                response.includes('second') ||
                response.includes('speed') ||
                response.includes('light')
            ).toBe(true);
        }, 30000);
    });

    describe('End-to-End: Classification and Confidence', () => {
        it('should process general knowledge questions with high confidence', async () => {
            mockMessage.content = 'Alia, what is the capital of France?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            // Should mention Paris
            expect(sentMessages[0].toLowerCase()).toContain('paris');

            // Check classification was logged
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant message classification',
                expect.objectContaining({
                    intent: 'general-knowledge',
                    confidence: expect.any(Number),
                    meetsThreshold: true,
                })
            );
        }, 30000);

        it('should process technical questions', async () => {
            mockMessage.content = 'Alia, explain what recursion is';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            const response = sentMessages[0].toLowerCase();
            expect(
                response.includes('function') ||
                response.includes('itself') ||
                response.includes('call')
            ).toBe(true);

            // Should be classified as technical-question or general-knowledge
            const classificationLog = (mockContext.log.info as jest.Mock).mock.calls.find(
                call => call[0] === 'Assistant message classification'
            );
            expect(classificationLog).toBeDefined();
            const intent = classificationLog[1].intent;
            expect(['technical-question', 'general-knowledge']).toContain(intent);
        }, 30000);
    });

    describe('End-to-End: Different Question Types', () => {
        it('should handle "what" questions', async () => {
            mockMessage.content = 'Alia, what is quantum mechanics?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].length).toBeGreaterThan(20);
        }, 30000);

        it('should handle "how" questions', async () => {
            mockMessage.content = 'Alia, how does a rainbow form?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            const response = sentMessages[0].toLowerCase();
            expect(
                response.includes('light') ||
                response.includes('water') ||
                response.includes('color')
            ).toBe(true);
        }, 30000);

        it('should handle "why" questions', async () => {
            mockMessage.content = 'Alia, why do seasons change?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            const response = sentMessages[0].toLowerCase();
            expect(
                response.includes('earth') ||
                response.includes('axis') ||
                response.includes('tilt') ||
                response.includes('sun')
            ).toBe(true);
        }, 30000);

        it('should handle "where" questions', async () => {
            mockMessage.content = 'Alia, where is the Great Barrier Reef?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            const response = sentMessages[0].toLowerCase();
            expect(response.includes('australia')).toBe(true);
        }, 30000);
    });

    describe('End-to-End: Response Quality', () => {
        it('should keep responses under Discord limit (2000 characters)', async () => {
            mockMessage.content = 'Alia, explain the entire history of computing';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);
            expect(sentMessages[0].length).toBeLessThan(2000);
        }, 30000);

        it('should provide concise, friendly responses', async () => {
            mockMessage.content = 'Alia, what is a black hole?';

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(sentMessages.length).toBe(1);

            // Should be informative but concise
            const response = sentMessages[0];
            expect(response.length).toBeGreaterThan(50);
            expect(response.length).toBeLessThan(1000);
        }, 30000);
    });

    describe('End-to-End: Logging and Metrics', () => {
        it('should log complete processing pipeline', async () => {
            mockMessage.content = 'Alia, what is the Pythagorean theorem?';

            await assistantResponse(mockMessage as Message, mockContext);

            // Should log all stages
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant processing directly addressed message',
                expect.any(Object)
            );

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant message classification',
                expect.any(Object)
            );

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant threshold met, processing intent',
                expect.any(Object)
            );

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant generating response for knowledge question',
                expect.any(Object)
            );

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API request initiated',
                expect.any(Object)
            );

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API response received',
                expect.any(Object)
            );

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant response sent successfully',
                expect.any(Object)
            );
        }, 30000);

        it('should log processing time end-to-end', async () => {
            mockMessage.content = 'Alia, what is the square root of 144?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Assistant response sent successfully',
                expect.objectContaining({
                    processingTimeMs: expect.any(Number),
                })
            );
        }, 30000);

        it('should log token usage', async () => {
            mockMessage.content = 'Alia, what is 2+2?';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API response received',
                expect.objectContaining({
                    tokensUsed: expect.any(Number),
                    promptTokens: expect.any(Number),
                    completionTokens: expect.any(Number),
                })
            );
        }, 30000);
    });

    describe('End-to-End: Real-World Examples', () => {
        const realWorldQuestions = [
            { question: 'Alia, what is machine learning?', keywords: ['algorithm', 'data', 'learn', 'computer'] },
            { question: 'Alia, how do vaccines work?', keywords: ['immune', 'antibod', 'disease', 'protection'] },
            { question: 'Alia, who invented the telephone?', keywords: ['bell', 'graham'] },
            { question: 'Alia, what is the formula for water?', keywords: ['h2o', 'hydrogen', 'oxygen'] },
            { question: 'Alia, explain Newton\'s first law', keywords: ['motion', 'rest', 'force', 'inertia'] },
        ];

        realWorldQuestions.forEach(({ question, keywords }) => {
            it(`should handle: "${question}"`, async () => {
                mockMessage.content = question;

                const result = await assistantResponse(mockMessage as Message, mockContext);

                expect(result).toBe(true);
                expect(sentMessages.length).toBe(1);

                const response = sentMessages[0].toLowerCase();
                const hasRelevantContent = keywords.some(keyword => response.includes(keyword));

                expect(hasRelevantContent).toBe(true);
            }, 30000);
        });
    });

    describe('End-to-End: Error Cases', () => {
        it('should handle missing channel gracefully', async () => {
            mockMessage.content = 'Alia, what is the universe?';
            mockMessage.channel = null as any;

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.warn).toHaveBeenCalledWith(
                'Assistant generated no response or channel not available',
                expect.objectContaining({
                    hasChannel: false,
                })
            );
        }, 30000);

        it('should handle channel send failure', async () => {
            mockMessage.content = 'Alia, what is artificial intelligence?';
            mockChannel.send = jest.fn().mockRejectedValue(new Error('Discord API error'));

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalled();
        }, 30000);
    });
});
