import { gatherAliaContext } from './alia-context';
import { _resetForTests, recordMessage } from './conversation-history';

describe('gatherAliaContext', () => {
    beforeEach(() => {
        _resetForTests();
    });

    function buildContext(overrides: Partial<any> = {}) {
        return {
            tables: {
                UserDescriptions: {
                    findAll: jest.fn().mockResolvedValue([]),
                },
                Memories: {
                    findAll: jest.fn().mockResolvedValue([]),
                },
                ...overrides.tables,
            },
            log: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() },
        } as any;
    }

    function buildMessage(overrides: any = {}) {
        return {
            guildId: 'g1',
            channelId: 'c1',
            content: 'hello world',
            author: { id: 'u-speaker' },
            client: { user: { id: 'bot' } },
            mentions: {
                users: overrides.mentionedUsers ?? new Map(),
            },
            ...overrides,
        } as any;
    }

    it('fetches descriptions for the speaker', async () => {
        const ctx = buildContext();
        ctx.tables.UserDescriptions.findAll.mockResolvedValueOnce([
            { description: 'a badass guitarist' },
            { description: 'always late' },
        ]);

        const result = await gatherAliaContext(buildMessage(), ctx);

        expect(result.speakerDescriptions).toEqual(['a badass guitarist', 'always late']);
        expect(ctx.tables.UserDescriptions.findAll).toHaveBeenCalledWith({
            where: { guild_id: 'g1', user_id: 'u-speaker' },
            limit: 5,
        });
    });

    it('fetches descriptions for mentioned users (excluding speaker and bot)', async () => {
        const ctx = buildContext();
        ctx.tables.UserDescriptions.findAll
            .mockResolvedValueOnce([]) // speaker
            .mockResolvedValueOnce([{ description: 'the one who pays' }]);

        const mentionedUsers = new Map<string, any>();
        mentionedUsers.set('u-speaker', { id: 'u-speaker', username: 'self' });
        mentionedUsers.set('bot', { id: 'bot', username: 'Alia' });
        mentionedUsers.set('u-other', { id: 'u-other', username: 'Derek' });

        const msg = buildMessage({ mentionedUsers });
        const result = await gatherAliaContext(msg, ctx);

        expect(result.mentionedUsers).toEqual([
            { displayName: 'Derek', descriptions: ['the one who pays'] },
        ]);
    });

    it('matches memories whose key appears in the message', async () => {
        const ctx = buildContext();
        ctx.tables.Memories.findAll.mockResolvedValueOnce([
            { key: 'dota', value: 'the game we all love to hate' },
            { key: 'unrelated', value: 'nope' },
            { key: 'world', value: 'big place' },
        ]);

        const msg = buildMessage({ content: 'hello world, are you playing dota tonight?' });
        const result = await gatherAliaContext(msg, ctx);

        const keys = result.relevantMemories.map(m => m.key);
        expect(keys).toContain('dota');
        expect(keys).toContain('world');
        expect(keys).not.toContain('unrelated');
    });

    it('skips memory keys shorter than the minimum', async () => {
        const ctx = buildContext();
        ctx.tables.Memories.findAll.mockResolvedValueOnce([
            { key: 'a', value: 'too short' },
            { key: 'ok', value: 'also too short' },
        ]);
        const result = await gatherAliaContext(buildMessage({ content: 'a ok' }), ctx);
        expect(result.relevantMemories).toHaveLength(0);
    });

    it('includes channel history', async () => {
        recordMessage('c1', 'user', 'alice', 'earlier');
        const ctx = buildContext();
        const result = await gatherAliaContext(buildMessage(), ctx);
        expect(result.history).toHaveLength(1);
        expect(result.history[0].content).toBe('earlier');
    });

    it('returns empty context when not in a guild', async () => {
        const ctx = buildContext();
        const msg = buildMessage({ guildId: null });
        const result = await gatherAliaContext(msg, ctx);
        expect(result.speakerDescriptions).toEqual([]);
        expect(result.mentionedUsers).toEqual([]);
        expect(ctx.tables.UserDescriptions.findAll).not.toHaveBeenCalled();
    });

    it('swallows errors and returns safe defaults', async () => {
        const ctx = buildContext();
        ctx.tables.UserDescriptions.findAll.mockRejectedValueOnce(new Error('db down'));
        const result = await gatherAliaContext(buildMessage(), ctx);
        expect(result.speakerDescriptions).toEqual([]);
        expect(ctx.log.warn).toHaveBeenCalled();
    });
});
