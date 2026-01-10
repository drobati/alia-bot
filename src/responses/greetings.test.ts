import { createContext } from "../utils/testHelpers";
import greetings, {
    GOODMORNING_MESSAGES,
    GOODNIGHT_MESSAGES,
    COOLDOWN_MS,
    resetCooldowns,
} from "./greetings";

describe('response/greetings', () => {
    let context: any;
    let message: any;
    let mockChannelSend: jest.Mock;

    beforeEach(() => {
        // Reset cooldowns between tests
        resetCooldowns();

        context = createContext();
        mockChannelSend = jest.fn();
        message = {
            content: 'good morning',
            author: { id: '1234', username: 'testuser' },
            channel: {
                id: 'channel-123',
                send: mockChannelSend,
            },
            id: 'msg-123',
        };
        // Reset Math.random for predictable tests
        jest.spyOn(Math, 'random');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('goodmorning patterns', () => {
        it('responds to "good morning"', async () => {
            message.content = 'good morning';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODMORNING_MESSAGES[0]);
        });

        it('responds to "goodmorning"', async () => {
            message.content = 'goodmorning';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODMORNING_MESSAGES[0]);
        });

        it('responds to "gm"', async () => {
            message.content = 'gm';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODMORNING_MESSAGES[0]);
        });

        it('responds to "morning everyone"', async () => {
            message.content = 'morning everyone';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODMORNING_MESSAGES[0]);
        });

        it('responds to "morning all"', async () => {
            message.content = 'morning all';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODMORNING_MESSAGES[0]);
        });

        it('is case insensitive', async () => {
            message.content = 'GOOD MORNING';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalled();
        });
    });

    describe('goodnight patterns', () => {
        it('responds to "good night"', async () => {
            message.content = 'good night';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODNIGHT_MESSAGES[0]);
        });

        it('responds to "goodnight"', async () => {
            message.content = 'goodnight';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODNIGHT_MESSAGES[0]);
        });

        it('responds to "gn"', async () => {
            message.content = 'gn';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODNIGHT_MESSAGES[0]);
        });

        it('responds to "night everyone"', async () => {
            message.content = 'night everyone';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODNIGHT_MESSAGES[0]);
        });

        it('responds to "nighty night"', async () => {
            message.content = 'nighty night';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledWith(GOODNIGHT_MESSAGES[0]);
        });

        it('is case insensitive', async () => {
            message.content = 'GOODNIGHT';
            (Math.random as jest.Mock).mockReturnValue(0);

            const result = await greetings(message, context);
            expect(result).toBe(true);
            expect(mockChannelSend).toHaveBeenCalled();
        });
    });

    describe('non-matching messages', () => {
        it('returns false for unrelated messages', async () => {
            message.content = 'hello world';
            const result = await greetings(message, context);
            expect(result).toBe(false);
            expect(mockChannelSend).not.toHaveBeenCalled();
        });

        it('returns false for very long messages', async () => {
            message.content = 'good morning everyone I hope you all have a wonderful day today and every day';
            const result = await greetings(message, context);
            expect(result).toBe(false);
            expect(mockChannelSend).not.toHaveBeenCalled();
        });
    });

    describe('cooldown behavior', () => {
        it('respects cooldown for same user in same channel', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

            // First greeting - should succeed
            const result1 = await greetings(message, context);
            expect(result1).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledTimes(1);

            // Second greeting immediately - should be blocked
            const result2 = await greetings(message, context);
            expect(result2).toBe(false);
            expect(mockChannelSend).toHaveBeenCalledTimes(1);
        });

        it('allows greetings from different users in same channel', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

            // First user greets
            const result1 = await greetings(message, context);
            expect(result1).toBe(true);

            // Different user greets - should succeed
            message.author.id = '5678';
            const result2 = await greetings(message, context);
            expect(result2).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledTimes(2);
        });

        it('allows greetings from same user in different channels', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

            // First channel greet
            const result1 = await greetings(message, context);
            expect(result1).toBe(true);

            // Different channel - should succeed
            message.channel.id = 'different-channel';
            const result2 = await greetings(message, context);
            expect(result2).toBe(true);
            expect(mockChannelSend).toHaveBeenCalledTimes(2);
        });
    });

    describe('random message selection', () => {
        it('selects different messages based on Math.random', async () => {
            message.content = 'good morning';

            // Select first message
            (Math.random as jest.Mock).mockReturnValue(0);
            await greetings(message, context);
            expect(mockChannelSend).toHaveBeenLastCalledWith(GOODMORNING_MESSAGES[0]);

            // Reset cooldown and select last message
            resetCooldowns();
            const lastIndex = (GOODMORNING_MESSAGES.length - 1) / GOODMORNING_MESSAGES.length;
            (Math.random as jest.Mock).mockReturnValue(lastIndex);
            await greetings(message, context);
            expect(mockChannelSend).toHaveBeenLastCalledWith(
                GOODMORNING_MESSAGES[GOODMORNING_MESSAGES.length - 1],
            );
        });
    });

    describe('logging', () => {
        it('logs debug info when greeting is sent', async () => {
            message.content = 'good morning';
            (Math.random as jest.Mock).mockReturnValue(0);

            await greetings(message, context);
            expect(context.log.debug).toHaveBeenCalledWith('Greeting response sent', expect.objectContaining({
                channelId: 'channel-123',
                messageId: 'msg-123',
                userId: '1234',
                greetingType: 'goodmorning',
            }));
        });

        it('logs with correct greeting type for goodnight', async () => {
            message.content = 'goodnight';
            (Math.random as jest.Mock).mockReturnValue(0);

            await greetings(message, context);
            expect(context.log.debug).toHaveBeenCalledWith('Greeting response sent', expect.objectContaining({
                greetingType: 'goodnight',
            }));
        });
    });

    describe('error handling', () => {
        it('handles errors gracefully', async () => {
            message.content = 'good morning';
            (Math.random as jest.Mock).mockReturnValue(0);
            mockChannelSend.mockRejectedValueOnce(new Error('Send failed'));

            const result = await greetings(message, context);
            expect(result).toBe(false);
            expect(context.log.error).toHaveBeenCalled();
        });
    });

    describe('exported constants', () => {
        it('exports expected constants', () => {
            expect(GOODMORNING_MESSAGES).toBeDefined();
            expect(GOODMORNING_MESSAGES.length).toBeGreaterThan(0);
            expect(GOODNIGHT_MESSAGES).toBeDefined();
            expect(GOODNIGHT_MESSAGES.length).toBeGreaterThan(0);
            expect(COOLDOWN_MS).toBe(60 * 60 * 1000);
        });
    });
});
