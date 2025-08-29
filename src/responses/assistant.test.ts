import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock the HybridClassifier
jest.mock('../utils/hybrid-classifier', () => ({
    HybridClassifier: jest.fn().mockImplementation(() => ({
        classify: jest.fn().mockReturnValue({
            intent: 'general-knowledge',
            confidence: 0.8,
            method: 'keyword'
        })
    }))
}));

// Mock the generateResponse function
jest.mock('../utils/assistant', () => jest.fn());

const mockMessage = {
    author: {
        bot: false,
        id: 'user-123',
        username: 'testuser'
    },
    content: 'What is the capital of France?',
    channel: {
        send: jest.fn(),
        startTyping: jest.fn(),
        stopTyping: jest.fn(),
    },
    guild: {
        id: 'guild-123'
    },
    reply: jest.fn(),
};

const mockContext = {
    log: {
        info: jest.fn(),
        error: jest.fn(),
        warn: jest.fn(),
    },
    tables: {
        Config: {
            findOne: jest.fn(),
            upsert: jest.fn(),
        }
    }
};

describe('Assistant Response', () => {
    let assistantResponse: any;
    let mockGenerateResponse: jest.Mock;

    beforeEach(async () => {
        jest.clearAllMocks();
        
        // Get the mocked generateResponse function
        mockGenerateResponse = require('../utils/assistant') as jest.Mock;
        mockGenerateResponse.mockImplementation(() => Promise.resolve('Paris is the capital of France.'));
        
        // Mock environment
        const originalEnv = process.env;
        process.env = { ...originalEnv, ASSISTANT_DEBUG: 'false' };
        
        // Import after mocking
        assistantResponse = (await import('./assistant')).default;
    });

    it('should ignore bot messages', async () => {
        const botMessage = {
            ...mockMessage,
            author: { ...mockMessage.author, bot: true }
        };

        await assistantResponse(botMessage, mockContext);

        expect(mockGenerateResponse).not.toHaveBeenCalled();
    });

    it('should process user messages with high confidence', async () => {
        mockContext.tables.Config.findOne.mockImplementation(() => 
            Promise.resolve({ value: JSON.stringify({ threadId: 'thread-123' }) })
        );

        await assistantResponse(mockMessage, mockContext);

        expect(mockGenerateResponse).toHaveBeenCalledWith(
            expect.objectContaining({
                message: mockMessage.content,
                threadId: 'thread-123'
            }),
            mockContext
        );
        expect(mockMessage.reply).toHaveBeenCalledWith('Paris is the capital of France.');
    });

    it('should handle low confidence classifications', async () => {
        // Mock low confidence classification
        const mockClassifier = require('../utils/hybrid-classifier').HybridClassifier;
        mockClassifier.mockImplementation(() => ({
            classify: jest.fn().mockReturnValue({
                intent: 'general-knowledge',
                confidence: 0.3,
                method: 'keyword'
            })
        }));

        const assistantResponseLowConf = (await import('./assistant')).default;
        await assistantResponseLowConf(mockMessage, mockContext);

        expect(mockGenerateResponse).not.toHaveBeenCalled();
    });

    it('should handle non-response intents', async () => {
        // Mock non-response intent
        const mockClassifier = require('../utils/hybrid-classifier').HybridClassifier;
        mockClassifier.mockImplementation(() => ({
            classify: jest.fn().mockReturnValue({
                intent: 'casual-conversation',
                confidence: 0.8,
                method: 'keyword'
            })
        }));

        const assistantResponseNonResponse = (await import('./assistant')).default;
        await assistantResponseNonResponse(mockMessage, mockContext);

        expect(mockGenerateResponse).not.toHaveBeenCalled();
    });

    it('should handle errors gracefully', async () => {
        mockGenerateResponse.mockImplementation(() => Promise.reject(new Error('API Error')));
        mockContext.tables.Config.findOne.mockImplementation(() => 
            Promise.resolve({ value: JSON.stringify({ threadId: 'thread-123' }) })
        );

        await assistantResponse(mockMessage, mockContext);

        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Error in assistant response:',
            expect.any(Error)
        );
    });
});