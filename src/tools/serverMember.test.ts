import { serverMemberTool } from './serverMember';
import { createContext, createTable } from '../utils/testHelpers';

function ctx(mentionedId: string | null, descriptions: Array<{ description: string }>) {
    const context = createContext();
    const table = createTable();
    table.findAll.mockResolvedValue(descriptions);
    context.tables.UserDescriptions = table;

    const message = {
        guildId: 'g1',
        mentions: {
            users: {
                first: () => (mentionedId ? { id: mentionedId, username: 'derek' } : undefined),
            },
        },
    };
    return { toolCtx: { message: message as never, context: context as never }, table };
}

describe('serverMemberTool', () => {
    it('answers with the descriptions stored for the mentioned user', async () => {
        const { toolCtx } = ctx('u1', [{ description: 'runs the server' }, { description: 'plays dota badly' }]);

        const answer = await serverMemberTool.run('who is @derek?', toolCtx);

        expect(answer?.title).toContain('derek');
        expect(answer?.body).toContain('runs the server');
        expect(answer?.body).toContain('plays dota badly');
        expect(answer?.sourceLabel).toBe('what people told me');
    });

    it('returns null when nobody is mentioned, rather than guessing who is meant', async () => {
        const { toolCtx, table } = ctx(null, []);
        expect(await serverMemberTool.run('who is that guy?', toolCtx)).toBeNull();
        expect(table.findAll).not.toHaveBeenCalled();
    });

    it('returns null when the user has no descriptions yet', async () => {
        const { toolCtx, table } = ctx('u1', []);
        expect(await serverMemberTool.run('who is @derek?', toolCtx)).toBeNull();
        expect(table.findAll).toHaveBeenCalledWith({
            where: { guild_id: 'g1', user_id: 'u1' },
            limit: 5,
        });
    });

    it('returns null outside a guild', async () => {
        const context = createContext();
        const table = createTable();
        context.tables.UserDescriptions = table;
        const message = { guildId: null, mentions: { users: { first: () => ({ id: 'u1', username: 'd' }) } } };
        expect(await serverMemberTool.run('who is @derek?',
            { message: message as never, context: context as never })).toBeNull();
        expect(table.findAll).not.toHaveBeenCalled();
    });

    it('returns null when the lookup throws', async () => {
        const { toolCtx, table } = ctx('u1', []);
        table.findAll.mockRejectedValue(new Error('db down'));
        expect(await serverMemberTool.run('who is @derek?', toolCtx)).toBeNull();
    });
});
