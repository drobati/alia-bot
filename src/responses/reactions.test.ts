import { createContext } from '../utils/testHelpers';
import reactions, {
    REACTION_PREFIXES,
    GAME_PREFIXES,
    REACTION_CHANCE,
    COOLDOWN_MS,
    LOUDS_REGEX,
    filterReactionEmoji,
    resetCooldowns,
} from './reactions';

describe('response/reactions', () => {
    let context: any;
    let message: any;
    let mockReact: jest.Mock;

    function createMockEmoji(name: string, available = true) {
        return { name, available, id: `emoji-${name}` };
    }

    const reactionEmoji = [
        createMockEmoji('yes_bet'),
        createMockEmoji('no_nope'),
        createMockEmoji('hype_sheeeit'),
        createMockEmoji('roast_bruh'),
        createMockEmoji('meh_lol'),
        createMockEmoji('SatisfiedBob'),
    ];

    const gameEmoji = [
        createMockEmoji('dota2_Pudge'),
        createMockEmoji('poe_chaos'),
        createMockEmoji('wow_horde'),
    ];

    const allEmoji = [...reactionEmoji, ...gameEmoji];

    beforeEach(() => {
        resetCooldowns();
        context = createContext();
        mockReact = jest.fn().mockResolvedValue(undefined);
        message = {
            content: 'hey what is up everyone',
            author: { id: '1234', username: 'testuser', bot: false },
            channel: { id: 'channel-123' },
            channelId: 'channel-123',
            id: 'msg-123',
            guild: {
                emojis: {
                    cache: {
                        filter: jest.fn(fn => ({
                            values: () => allEmoji.filter(fn),
                        })),
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
            (Math.random as jest.Mock).mockReturnValue(0.99);

            await reactions(message, context);
            expect(mockReact).not.toHaveBeenCalled();
        });
    });

    describe('secret tag', () => {
        it('always reacts to "kwisatz haderach"', async () => {
            message.content = 'the kwisatz haderach has arrived';
            (Math.random as jest.Mock).mockReturnValue(0.99);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);
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
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);

            // Secret tag should still work despite cooldown
            message.content = 'kwisatz haderach';
            (Math.random as jest.Mock).mockReturnValue(0.99);
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(2);
        });

        it('uses a reaction-appropriate emoji (not game emoji)', async () => {
            message.content = 'kwisatz haderach';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            const reactedWith = mockReact.mock.calls[0][0];
            // Should be one of the reaction emoji, not a game one
            const reactionNames = reactionEmoji.map(e => e.name);
            expect(reactionNames).toContain(reactedWith.name);
        });
    });

    describe('channel cooldown', () => {
        it('respects cooldown per channel', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

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

            message.channelId = 'channel-456';
            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(2);
        });
    });

    describe('random emoji selection', () => {
        it('reacts to any message when chance is met', async () => {
            message.content = 'just a normal everyday message';
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).toHaveBeenCalledTimes(1);
        });

        it('picks from reaction-appropriate emoji only', async () => {
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            const reactedWith = mockReact.mock.calls[0][0];
            const reactionNames = reactionEmoji.map(e => e.name);
            expect(reactionNames).toContain(reactedWith.name);
        });

        it('does not react when no reaction emoji available', async () => {
            // Only game emoji available
            message.guild.emojis.cache.filter = jest.fn(fn => ({
                values: () => gameEmoji.filter(fn),
            }));
            (Math.random as jest.Mock).mockReturnValue(0);

            await reactions(message, context);
            expect(mockReact).not.toHaveBeenCalled();
        });
    });

    describe('filterReactionEmoji', () => {
        it('includes emoji with reaction prefixes', () => {
            const emojis = [
                createMockEmoji('yes_bet'),
                createMockEmoji('no_nope'),
                createMockEmoji('hype_sheeeit'),
                createMockEmoji('roast_bruh'),
                createMockEmoji('stfu_shutup'),
                createMockEmoji('vibe_wtf'),
                createMockEmoji('meh_mid'),
                createMockEmoji('misc_popcorn'),
            ] as any[];

            const result = filterReactionEmoji(emojis);
            expect(result).toHaveLength(8);
        });

        it('excludes game-specific emoji', () => {
            const emojis = [
                createMockEmoji('dota2_Pudge'),
                createMockEmoji('poe_chaos'),
                createMockEmoji('wow_horde'),
                createMockEmoji('arc_raiders'),
            ] as any[];

            const result = filterReactionEmoji(emojis);
            expect(result).toHaveLength(0);
        });

        it('includes unprefixed emoji (no underscore)', () => {
            const emojis = [
                createMockEmoji('SatisfiedBob'),
                createMockEmoji('scroll'),
                createMockEmoji('regal'),
            ] as any[];

            const result = filterReactionEmoji(emojis);
            expect(result).toHaveLength(3);
        });

        it('excludes emoji with unknown prefixes', () => {
            const emojis = [
                createMockEmoji('unknown_something'),
            ] as any[];

            const result = filterReactionEmoji(emojis);
            expect(result).toHaveLength(0);
        });

        it('skips emoji with null name', () => {
            const emojis = [{ name: null, available: true }] as any[];
            const result = filterReactionEmoji(emojis);
            expect(result).toHaveLength(0);
        });

        it('handles mixed set correctly', () => {
            const emojis = [
                createMockEmoji('yes_bet'),
                createMockEmoji('dota2_Pudge'),
                createMockEmoji('SatisfiedBob'),
                createMockEmoji('poe_chaos'),
                createMockEmoji('roast_bruh'),
            ] as any[];

            const result = filterReactionEmoji(emojis);
            expect(result).toHaveLength(3);
            expect(result.map((e: any) => e.name)).toEqual([
                'yes_bet', 'SatisfiedBob', 'roast_bruh',
            ]);
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
            (Math.random as jest.Mock).mockReturnValue(0);
            mockReact.mockRejectedValueOnce(new Error('React failed'));

            await reactions(message, context);
            expect(context.log.debug).toHaveBeenCalledWith(
                'Reaction failed',
                expect.objectContaining({ error: expect.any(Error) }),
            );
        });
    });

    describe('exported constants', () => {
        it('exports expected constants', () => {
            expect(REACTION_PREFIXES).toBeDefined();
            expect(REACTION_PREFIXES.length).toBeGreaterThan(0);
            expect(GAME_PREFIXES).toBeDefined();
            expect(GAME_PREFIXES.length).toBeGreaterThan(0);
            expect(REACTION_CHANCE).toBe(0.05);
            expect(COOLDOWN_MS).toBe(5 * 60 * 1000);
        });
    });
});
