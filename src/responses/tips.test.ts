import { createContext } from "../utils/testHelpers";
import tips, { TIPS, TIP_CHANCE, COOLDOWN_MS, resetCooldowns } from "./tips";

describe('response/tips', () => {
    let context: any;
    let message: any;
    let mockChannelSend: jest.Mock;

    beforeEach(() => {
        // Reset cooldowns between tests
        resetCooldowns();

        context = createContext();
        mockChannelSend = jest.fn();
        message = {
            content: 'This is a normal message with enough characters',
            author: { id: '1234', username: 'testuser' },
            channel: {
                id: 'channel-123',
                send: mockChannelSend,
            },
        };
        // Reset Math.random for predictable tests
        jest.spyOn(Math, 'random');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    it('returns false for short messages', async () => {
        message.content = 'hi';
        const result = await tips(message, context);
        expect(result).toBe(false);
        expect(mockChannelSend).not.toHaveBeenCalled();
    });

    it('returns false when random chance fails', async () => {
        // Make Math.random return a value higher than TIP_CHANCE
        (Math.random as jest.Mock).mockReturnValue(0.5);

        const result = await tips(message, context);
        expect(result).toBe(false);
        expect(mockChannelSend).not.toHaveBeenCalled();
    });

    it('sends a tip when random chance succeeds', async () => {
        // Make Math.random return 0 (below TIP_CHANCE) for the chance check
        // and a valid index for tip selection
        (Math.random as jest.Mock)
            .mockReturnValueOnce(0) // For chance check (will succeed)
            .mockReturnValueOnce(0); // For tip selection (first tip)

        const result = await tips(message, context);
        expect(result).toBe(true);
        expect(mockChannelSend).toHaveBeenCalledWith(`**Tip:** ${TIPS[0]}`);
    });

    it('respects cooldown period', async () => {
        // First call - should succeed
        (Math.random as jest.Mock)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0);

        const result1 = await tips(message, context);
        expect(result1).toBe(true);
        expect(mockChannelSend).toHaveBeenCalledTimes(1);

        // Second call immediately after - should be blocked by cooldown
        (Math.random as jest.Mock)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0);

        const result2 = await tips(message, context);
        expect(result2).toBe(false);
        expect(mockChannelSend).toHaveBeenCalledTimes(1); // Still only 1 call
    });

    it('allows tips in different channels during cooldown', async () => {
        // First call in channel 1
        (Math.random as jest.Mock)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0);

        const result1 = await tips(message, context);
        expect(result1).toBe(true);

        // Second call in different channel - should succeed
        message.channel.id = 'different-channel';
        (Math.random as jest.Mock)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0);

        const result2 = await tips(message, context);
        expect(result2).toBe(true);
        expect(mockChannelSend).toHaveBeenCalledTimes(2);
    });

    it('logs debug info when tip is sent', async () => {
        (Math.random as jest.Mock)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0);

        await tips(message, context);
        expect(context.log.debug).toHaveBeenCalledWith('Tip sent', expect.objectContaining({
            channelId: 'channel-123',
            messageId: message.id,
            userId: '1234',
        }));
    });

    it('exports expected constants', () => {
        expect(TIPS).toBeDefined();
        expect(TIPS.length).toBeGreaterThan(0);
        expect(TIP_CHANCE).toBe(0.05);
        expect(COOLDOWN_MS).toBe(5 * 60 * 1000);
    });

    it('handles errors gracefully', async () => {
        (Math.random as jest.Mock)
            .mockReturnValueOnce(0)
            .mockReturnValueOnce(0);

        mockChannelSend.mockRejectedValueOnce(new Error('Send failed'));

        const result = await tips(message, context);
        expect(result).toBe(false);
        expect(context.log.error).toHaveBeenCalled();
    });
});
