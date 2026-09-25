import { Op } from 'sequelize';
import { recordClassification, pruneClassificationLog } from './classification-log';
import { createContext, createTable } from './testHelpers';

describe('recordClassification', () => {
    let context: ReturnType<typeof createContext>;
    let table: ReturnType<typeof createTable>;

    beforeEach(() => {
        context = createContext();
        table = createTable();
        context.tables.ClassificationLog = table;
    });

    const params = {
        guildId: 'g1',
        channelId: 'c1',
        messageId: 'm1',
        content: 'what can you do?',
        addressed: false,
        classification: {
            type: 'bot_capability' as const,
            confidence: 0.75,
            alternatives: [{ type: 'directed_at_human' as const, p: 0.23 }],
        },
        route: 'silent',
        reason: 'below_floor' as const,
    };

    it('writes the winner, the confidence and the runners-up', async () => {
        await recordClassification(context as never, params);

        expect(table.create).toHaveBeenCalledWith(expect.objectContaining({
            guild_id: 'g1',
            channel_id: 'c1',
            message_id: 'm1',
            content: 'what can you do?',
            addressed: false,
            type: 'bot_capability',
            confidence: 0.75,
            alternatives: [{ type: 'directed_at_human', p: 0.23 }],
            route: 'silent',
            reason: 'below_floor',
        }));
    });

    it('truncates content to the column width', async () => {
        await recordClassification(context as never, { ...params, content: 'x'.repeat(400) });

        const written = table.create.mock.calls[0][0];
        expect(written.content).toHaveLength(255);
    });

    it('never throws when the insert fails, and warns instead', async () => {
        table.create.mockRejectedValue(new Error('db down'));

        await expect(recordClassification(context as never, params)).resolves.toBeUndefined();
        expect(context.log.warn).toHaveBeenCalled();
    });
});

describe('pruneClassificationLog', () => {
    const THIRTY_DAYS_MS = 30 * 24 * 60 * 60 * 1000;

    it('destroys rows older than the cutoff and returns the count', async () => {
        const context = createContext();
        const table = createTable();
        table.destroy.mockResolvedValue(7);
        context.tables.ClassificationLog = table;

        const before = Date.now();
        const removed = await pruneClassificationLog(context as never, 30);
        const after = Date.now();

        expect(removed).toBe(7);
        // Op.gt would delete every recent row on each hourly tick and leave the
        // table permanently empty. This must fail if `lt` becomes `gt`.
        expect(table.destroy).toHaveBeenCalledWith({
            where: { created_at: { [Op.lt]: expect.any(Date) } },
        });

        const cutoff = (table.destroy.mock.calls[0][0].where.created_at[Op.lt] as Date).getTime();
        expect(cutoff).toBeGreaterThanOrEqual(before - THIRTY_DAYS_MS - 1000);
        expect(cutoff).toBeLessThanOrEqual(after - THIRTY_DAYS_MS + 1000);
    });
});
