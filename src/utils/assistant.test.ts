import { describe, it, expect, beforeEach, jest } from '@jest/globals';

// Mock fetch globally
const mockFetch = jest.fn() as jest.MockedFunction<typeof fetch>;
(global as any).fetch = mockFetch;

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

describe('Assistant Utility', () => {
    let generateResponse: any;
    
    beforeEach(async () => {
        jest.clearAllMocks();
        
        // Mock environment variables
        process.env.OPENAI_API_KEY = 'test-api-key';
        
        // Import after setting up mocks
        generateResponse = (await import('./assistant')).default;
    });

    it('should handle missing API key', async () => {
        delete process.env.OPENAI_API_KEY;

        await expect(generateResponse({
            message: 'Test question',
            threadId: 'thread-123'
        }, mockContext)).rejects.toThrow('OpenAI API key not configured');
    });

    it('should call OpenAI API with correct structure', async () => {
        mockFetch.mockResolvedValue({
            ok: true,
            json: () => Promise.resolve({
                choices: [{
                    message: {
                        content: 'Test response'
                    }
                }]
            })
        } as Response);

        const result = await generateResponse({
            message: 'Test question',
            threadId: 'thread-123'
        }, mockContext);

        expect(result).toBe('Test response');
        expect(mockFetch).toHaveBeenCalledWith(
            'https://api.openai.com/v1/chat/completions',
            expect.objectContaining({
                method: 'POST',
                headers: expect.objectContaining({
                    'Authorization': 'Bearer test-api-key',
                    'Content-Type': 'application/json'
                })
            })
        );
    });

    it('should handle API errors', async () => {
        mockFetch.mockResolvedValue({
            ok: false,
            status: 500,
            statusText: 'Internal Server Error'
        } as Response);

        await expect(generateResponse({
            message: 'Test question',
            threadId: 'thread-123'
        }, mockContext)).rejects.toThrow('OpenAI API error: 500 Internal Server Error');
    });
});