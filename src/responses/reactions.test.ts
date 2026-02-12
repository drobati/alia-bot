import { createContext } from '../utils/testHelpers';
import reactions, {
    KEYWORD_REACTIONS,
    REACTION_CHANCE,
    COOLDOWN_MS,
    LOUDS_REGEX,
    SECRET_TAG,
    ALL_EMOJI,
    findContextualCustomEmoji,
    findKeywordReaction,
    resetCooldowns,
} from './reactions';

describe('response/reactions', () => {
    let context: any;
    let message: any;
    let mockReact: jest.Mock;

    function createMockEmoji(name: string, available = true) {
        return { name, available, id: `emoji-${name}` };
    }

    beforeEach(() => {
        resetCooldowns();
        context = createContext();
        mockReact = jest.fn().mockResolvedValue(undefined);
        message = {
            content: 'this is so cool',
            author: { id: '1234', username: 'testuser', bot: false },
            channel: { id: 'channel-123' },
            channelId: 'channel-123',
            id: 'msg-123',
            guild: {
                emojis: {
                    cache: {
                        filter: jest.fn().mockReturnValue({
                            values: () => [],
                        }),
                    },
                },
            },
            react: mockReact,
        };
        jest.spyOn(Math, 'random');
    });

    afterEach(() => {
        jest.restoreAllMocks();
    });

    describe('skipping conditions', () => {
        it('skips messages without a guild (DMs)', async () => {
            message.guild = null;
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).not.toHaveBeenCalled();
        });

        it('skips LOUDS messages (all caps)', async () => {
            message.content = 'THIS IS A LOUD MESSAGE';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).not.toHaveBeenCalled();
        });

        it('skips very short messages', async () => {
            message.content = 'ok';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).not.toHaveBeenCalled();
        });

        it('skips when random chance is not met', async () => {
            message.content = 'this is so cool';
            // Return value > REACTION_CHANCE to skip
            (Math.random as jest.Mock).mockReturnValue(0.99);

            await reactions(message, context);
            expect(mockReact).not.toHaveBeenCalled();
        });
    });

    describe('secret tag', () => {
        it('always reacts to "kwisatz haderach"', async () => {
            message.content = 'the kwisatz haderach has arrived';
            // Even with a high random value (would normally skip)
            (Math.random as jest.Mock).mockReturnValue(0.99);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);
            expect(ALL_EMOJI).toContain(mockReact.mock.calls[0][0]);
        });

        it('is case insensitive', async () => {
            message.content = 'KWISATZ HADERACH';
            (Math.random as jest.Mock).mockReturnValue(0.99);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);
        });

        it('bypasses channel cooldown', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

            // Trigger a normal reaction first to set cooldown
            message.content = 'lol that was funny';
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);

            // Secret tag should still work despite cooldown
            message.content = 'kwisatz haderach';
            (Math.random as jest.Mock).mockReturnValue(0.99);
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(2);
        });

        it('reacts with an emoji from ALL_EMOJI', async () => {
            message.content = 'kwisatz haderach';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            const reactedEmoji = mockReact.mock.calls[0][0];
            expect(ALL_EMOJI).toContain(reactedEmoji);
        });
    });

    describe('channel cooldown', () => {
        it('respects cooldown per channel', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

            // First reaction should succeed
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);

            // Second reaction in same channel immediately — should be blocked
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);
        });

        it('allows reactions in different channels', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);

            // Different channel
            message.channelId = 'channel-456';
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(2);
        });
    });

    describe('keyword reactions', () => {
        it('reacts with emoji for keyword "lol"', async () => {
            message.content = 'lol that was funny';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledWith('😂');
        });

        it('reacts with emoji for keyword "fire"', async () => {
            message.content = 'that track is fire';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledWith('🔥');
        });

        it('reacts with emoji for keyword "thanks"', async () => {
            message.content = 'thanks for the help';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledWith('💜');
        });

        it('reacts with emoji for keyword "congrats"', async () => {
            message.content = 'congrats on the promotion';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledWith('🎉');
        });

        it('reacts with emoji for keyword "coffee"', async () => {
            message.content = 'i need coffee right now';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledWith('☕');
        });

        it('does not react when no keyword matches', async () => {
            message.content = 'just a normal message about nothing';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).not.toHaveBeenCalled();
        });
    });

    describe('custom emoji matching', () => {
        it('prefers custom emoji when name matches message content', async () => {
            const customEmoji = createMockEmoji('cool');
            message.content = 'that is so cool';
            message.guild.emojis.cache.filter = jest.fn().mockReturnValue({
                values: () => [customEmoji],
            });
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledWith(customEmoji);
        });

        it('falls back to keyword emoji when no custom emoji matches', async () => {
            message.content = 'lol that was great';
            message.guild.emojis.cache.filter = jest.fn().mockReturnValue({
                values: () => [createMockEmoji('unrelated')],
            });
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledWith('😂');
        });
    });

    describe('findContextualCustomEmoji', () => {
        it('returns matching emoji when name appears in content', () => {
            const emojis = [
                createMockEmoji('cool'),
                createMockEmoji('fire'),
            ] as any[];

            const result = findContextualCustomEmoji('that is so cool', emojis);
            expect(result).toEqual(emojis[0]);
        });

        it('returns null when no emoji name matches', () => {
            const emojis = [createMockEmoji('pepehands')] as any[];
            const result = findContextualCustomEmoji('hello world', emojis);
            expect(result).toBeNull();
        });

        it('is case insensitive', () => {
            const emojis = [createMockEmoji('Cool')] as any[];
            const result = findContextualCustomEmoji('that is so COOL', emojis);
            expect(result).toEqual(emojis[0]);
        });

        it('skips emojis with null name', () => {
            const emojis = [{ name: null, available: true }] as any[];
            const result = findContextualCustomEmoji('hello', emojis);
            expect(result).toBeNull();
        });
    });

    describe('findKeywordReaction', () => {
        it('returns emoji for matching keyword', () => {
            expect(findKeywordReaction('lol so funny')).toBe('😂');
            expect(findKeywordReaction('this is fire')).toBe('🔥');
            expect(findKeywordReaction('gg everyone')).toBe('🫡');
            expect(findKeywordReaction('rip my keyboard')).toBe('🪦');
        });

        it('returns null for no match', () => {
            expect(findKeywordReaction('just a regular message')).toBeNull();
        });

        it('returns first matching keyword', () => {
            // "lol" matches before "cool"
            expect(findKeywordReaction('lol that was cool')).toBe('😂');
        });
    });

    describe('LOUDS_REGEX', () => {
        it('matches all-caps messages', () => {
            expect(LOUDS_REGEX.test('THIS IS LOUD')).toBe(true);
            expect(LOUDS_REGEX.test('HELLO WORLD!')).toBe(true);
        });

        it('does not match mixed-case messages', () => {
            expect(LOUDS_REGEX.test('This is not loud')).toBe(false);
            expect(LOUDS_REGEX.test('hello world')).toBe(false);
        });
    });

    describe('error handling', () => {
        it('handles react failures gracefully', async () => {
            message.content = 'lol so funny';
            (Math.random as jest.Mock).mockReturnValue(0);
            mockReact.mockRejectedValueOnce(new Error('React failed'));

            // Should not throw
            await reactions(message, context);
            expect(context.log.debug).toHaveBeenCalledWith(
                'Reaction failed',
                expect.objectContaining({ error: expect.any(Error) }),
            );
        });
    });

    describe('exported constants', () => {
        it('exports expected constants', () => {
            expect(KEYWORD_REACTIONS).toBeDefined();
            expect(KEYWORD_REACTIONS.length).toBeGreaterThan(0);
            expect(REACTION_CHANCE).toBe(0.05);
            expect(COOLDOWN_MS).toBe(5 * 60 * 1000);
        });
    });
});
