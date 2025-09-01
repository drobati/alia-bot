import { safelySendToChannel, safelyFindChannel, sendWithRetry } from './discordHelpers';
import { Context } from './types';

// Mock channel
const mockChannel = {
    id: 'channel123',
    name: 'test-channel',
    send: jest.fn(),
    isTextBased: jest.fn().mockReturnValue(true),
    guild: {
        id: 'guild123',
        members: {
            cache: new Map([['bot123', { permissions: { has: jest.fn().mockReturnValue(true) } }]]),
        },
    },
    client: {
        user: { id: 'bot123' },
    },
    permissionsFor: jest.fn().mockReturnValue({ has: jest.fn().mockReturnValue(true) }),
};

// Mock client with proper cache implementation
const mockClient = {
    channels: {
        cache: {
            find: jest.fn().mockImplementation((predicate: any) => {
                // Return mockChannel if the predicate matches our test channel
                if (predicate && typeof predicate === 'function') {
                    return predicate(mockChannel) ? mockChannel : undefined;
                }
                return undefined;
            }),
            size: 1,
        },
        fetch: jest.fn(),
    },
};

// Mock context
const mockContext: Context = {
    log: {
        info: jest.fn(),
        warn: jest.fn(),
        error: jest.fn(),
        debug: jest.fn(),
        trace: jest.fn(),
        fatal: jest.fn(),
        logCommand: jest.fn(),
        logDiscordEvent: jest.fn(),
        logApiCall: jest.fn(),
        logDatabaseOperation: jest.fn(),
        child: jest.fn(),
    } as any,
} as any;

describe('Discord Helpers', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        mockChannel.send.mockResolvedValue({});
    });

    describe('safelySendToChannel', () => {
        it('should send message to valid channel', async () => {
            const result = await safelySendToChannel(
                mockChannel as any,
                'test message',
                mockContext,
            );

            expect(result).toBe(true);
            expect(mockChannel.send).toHaveBeenCalledWith('test message');
        });

        it('should handle null channel', async () => {
            const result = await safelySendToChannel(
                null,
                'test message',
                mockContext,
            );

            expect(result).toBe(false);
            expect(mockContext.log.warn).toHaveBeenCalled();
        });

        it('should handle channel send error', async () => {
            mockChannel.send.mockRejectedValue(new Error('Send failed'));

            const result = await safelySendToChannel(
                mockChannel as any,
                'test message',
                mockContext,
            );

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });

    describe('safelyFindChannel', () => {
        it('should find channel by name', () => {
            // Mock isTextBased to return true for our test channel
            mockChannel.isTextBased.mockReturnValue(true);

            const channelTypeCheck = (channel: any): channel is any =>
                channel.isTextBased();

            const result = safelyFindChannel(
                mockClient as any,
                'test-channel',
                channelTypeCheck,
                mockContext,
            );

            expect(result).toBe(mockChannel);
        });

        it('should return undefined when channel not found', () => {
            const channelTypeCheck = (channel: any): channel is any => false;

            const result = safelyFindChannel(
                mockClient as any,
                'nonexistent-channel',
                channelTypeCheck,
                mockContext,
            );

            expect(result).toBeUndefined();
        });

        it('should work without context', () => {
            // Mock isTextBased to return true for our test channel
            mockChannel.isTextBased.mockReturnValue(true);

            const channelTypeCheck = (channel: any): channel is any =>
                channel.isTextBased();

            const result = safelyFindChannel(
                mockClient as any,
                'test-channel',
                channelTypeCheck,
            );

            expect(result).toBe(mockChannel);
        });
    });

    describe('sendWithRetry', () => {
        it('should succeed on first attempt', async () => {
            const result = await sendWithRetry(
                mockChannel as any,
                'test message',
                mockContext,
            );

            expect(result).toBe(true);
            expect(mockChannel.send).toHaveBeenCalledTimes(1);
        });

        it('should retry on failure', async () => {
            mockChannel.send
                .mockRejectedValueOnce(new Error('First attempt failed'))
                .mockResolvedValue({});

            const result = await sendWithRetry(
                mockChannel as any,
                'test message',
                mockContext,
                2,
            );

            expect(result).toBe(true);
            expect(mockChannel.send).toHaveBeenCalledTimes(2);
        });

        it('should fail after exhausting retries', async () => {
            mockChannel.send.mockRejectedValue(new Error('Persistent failure'));

            const result = await sendWithRetry(
                mockChannel as any,
                'test message',
                mockContext,
                1,
            );

            expect(result).toBe(false);
            expect(mockChannel.send).toHaveBeenCalledTimes(1);
        });
    });
});