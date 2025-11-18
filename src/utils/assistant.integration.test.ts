/**
 * Integration tests for OpenAI Assistant functionality
 *
 * These tests make REAL API calls to OpenAI to verify the integration works correctly.
 * They are separate from unit tests which mock the OpenAI API.
 *
 * Prerequisites:
 * - OPENAI_API_KEY must be set in environment
 * - Tests will be skipped if API key is not available
 *
 * Run with: npm test assistant.integration.test.ts
 */

import generateResponse from './assistant';
import { Context } from './types';

// Skip all tests in this file if OPENAI_API_KEY is not set
const describeIfApiKey = process.env.OPENAI_API_KEY && process.env.OPENAI_API_KEY !== 'test-key-for-ci'
    ? describe
    : describe.skip;

describeIfApiKey('OpenAI Assistant Integration Tests', () => {
    let mockContext: Context;

    beforeEach(() => {
        // Create a real logger context (not mocked)
        mockContext = {
            log: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
        } as any;
    });

    describe('Basic Response Generation', () => {
        it('should generate a response for a simple general knowledge question', async () => {
            const message = 'What is photosynthesis?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            // Verify response is not null/empty
            expect(response).toBeTruthy();
            expect(typeof response).toBe('string');
            expect(response!.length).toBeGreaterThan(0);

            // Verify response is relevant (contains key terms)
            const lowerResponse = response!.toLowerCase();
            expect(
                lowerResponse.includes('plant') ||
                lowerResponse.includes('light') ||
                lowerResponse.includes('chlorophyll') ||
                lowerResponse.includes('energy') ||
                lowerResponse.includes('glucose')
            ).toBe(true);

            // Verify logging occurred
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API request initiated',
                expect.objectContaining({
                    userId: 'test-user-integration',
                    model: 'gpt-4-turbo-preview',
                })
            );

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API response received',
                expect.objectContaining({
                    userId: 'test-user-integration',
                    success: true,
                })
            );
        }, 30000); // 30 second timeout for API call

        it('should generate a response for a factual question', async () => {
            const message = 'What is the capital of France?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            expect(typeof response).toBe('string');

            // Should mention Paris
            expect(response!.toLowerCase()).toContain('paris');

            // Should be under Discord's character limit
            expect(response!.length).toBeLessThan(2000);
        }, 30000);

        it('should generate a response for a technical concept', async () => {
            const message = 'Explain what recursion is in programming';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            expect(typeof response).toBe('string');

            // Should contain relevant technical terms
            const lowerResponse = response!.toLowerCase();
            expect(
                lowerResponse.includes('function') ||
                lowerResponse.includes('itself') ||
                lowerResponse.includes('call')
            ).toBe(true);
        }, 30000);
    });

    describe('Response Quality and Constraints', () => {
        it('should keep responses under Discord message limit (2000 chars)', async () => {
            const message = 'Explain the entire history of the Roman Empire';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            expect(response!.length).toBeLessThan(2000);
        }, 30000);

        it('should provide concise responses as per system prompt', async () => {
            const message = 'What is gravity?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            // Response should be concise, not a multi-page essay
            expect(response!.length).toBeLessThan(1000);
        }, 30000);

        it('should handle questions with appropriate tone', async () => {
            const message = 'How do magnets work?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            // Should be friendly and helpful (Discord bot personality)
            expect(response!.length).toBeGreaterThan(20);
        }, 30000);
    });

    describe('Error Handling', () => {
        it('should handle empty messages gracefully', async () => {
            const message = '';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            // OpenAI will still process empty messages, but might return null or short response
            // The important thing is it doesn't crash
            expect(typeof response).toBe('string' as any);
        }, 30000);

        it('should log token usage information', async () => {
            const message = 'What is the speed of light?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            await generateResponse(message, mockContext, userContext);

            // Verify token usage is logged
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

    describe('Different Question Types', () => {
        it('should handle "what" questions', async () => {
            const message = 'What is DNA?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            const lowerResponse = response!.toLowerCase();
            expect(
                lowerResponse.includes('dna') ||
                lowerResponse.includes('genetic') ||
                lowerResponse.includes('cell')
            ).toBe(true);
        }, 30000);

        it('should handle "how" questions', async () => {
            const message = 'How does a computer store data?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            const lowerResponse = response!.toLowerCase();
            expect(
                lowerResponse.includes('bit') ||
                lowerResponse.includes('byte') ||
                lowerResponse.includes('memory') ||
                lowerResponse.includes('storage')
            ).toBe(true);
        }, 30000);

        it('should handle "why" questions', async () => {
            const message = 'Why is the sky blue?';
            const userContext = {
                userId: 'test-user-integration',
                username: 'integration-tester',
                channelId: 'test-channel',
            };

            const response = await generateResponse(message, mockContext, userContext);

            expect(response).toBeTruthy();
            const lowerResponse = response!.toLowerCase();
            expect(
                lowerResponse.includes('light') ||
                lowerResponse.includes('scatter') ||
                lowerResponse.includes('atmosphere')
            ).toBe(true);
        }, 30000);
    });

    describe('Context and User Information', () => {
        it('should include user context in API request logging', async () => {
            const message = 'What is quantum physics?';
            const userContext = {
                userId: 'user-123',
                username: 'testuser',
                channelId: 'channel-456',
            };

            await generateResponse(message, mockContext, userContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API request initiated',
                expect.objectContaining({
                    userId: 'user-123',
                })
            );
        }, 30000);

        it('should work without optional user context', async () => {
            const message = 'What is 2+2?';

            const response = await generateResponse(message, mockContext);

            expect(response).toBeTruthy();
            expect(response!).toContain('4');
        }, 30000);
    });

    describe('API Configuration Validation', () => {
        it('should use correct model (gpt-4-turbo-preview)', async () => {
            const message = 'Test message';
            const userContext = {
                userId: 'test-user',
                username: 'tester',
                channelId: 'test-channel',
            };

            await generateResponse(message, mockContext, userContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API request initiated',
                expect.objectContaining({
                    model: 'gpt-4-turbo-preview',
                })
            );
        }, 30000);

        it('should use appropriate token limits and temperature', async () => {
            const message = 'Test configuration';
            const userContext = {
                userId: 'test-user',
                username: 'tester',
                channelId: 'test-channel',
            };

            await generateResponse(message, mockContext, userContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API request initiated',
                expect.objectContaining({
                    maxTokens: 300,
                    temperature: 0.7,
                })
            );
        }, 30000);
    });

    describe('Performance and Timing', () => {
        it('should complete within reasonable time (under 30 seconds)', async () => {
            const startTime = Date.now();
            const message = 'What is the meaning of life?';
            const userContext = {
                userId: 'test-user',
                username: 'tester',
                channelId: 'test-channel',
            };

            await generateResponse(message, mockContext, userContext);

            const endTime = Date.now();
            const duration = endTime - startTime;

            expect(duration).toBeLessThan(30000); // Less than 30 seconds
        }, 30000);

        it('should log processing time', async () => {
            const message = 'Quick test question';
            const userContext = {
                userId: 'test-user',
                username: 'tester',
                channelId: 'test-channel',
            };

            await generateResponse(message, mockContext, userContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'OpenAI API response received',
                expect.objectContaining({
                    processingTimeMs: expect.any(Number),
                })
            );

            // Get the actual processing time from the log call
            const logCall = (mockContext.log.info as jest.Mock).mock.calls.find(
                call => call[0] === 'OpenAI API response received'
            );
            const processingTime = logCall[1].processingTimeMs;

            expect(processingTime).toBeGreaterThan(0);
            expect(processingTime).toBeLessThan(30000);
        }, 30000);
    });
});
