import { isPassiveChannel, setPassiveChannel, clearPassiveChannelCache } from './passive-channels';
import { createContext, createTable } from './testHelpers';

function setup(value: string | null) {
    const context = createContext();
    const table = createTable();
    table.findOne.mockResolvedValue(value === null ? null : { key: 'k', value });
    context.tables.Config = table;
    return { context, table };
}

describe('isPassiveChannel', () => {
    beforeEach(() => clearPassiveChannelCache());

    it('is true for a channel in the list', async () => {
        const { context } = setup(JSON.stringify(['c1', 'c2']));
        expect(await isPassiveChannel(context as never, 'g1', 'c2')).toBe(true);
    });

    it('is false for a channel not in the list', async () => {
        const { context } = setup(JSON.stringify(['c1']));
        expect(await isPassiveChannel(context as never, 'g1', 'c9')).toBe(false);
    });

    it('is false when the guild has no config at all', async () => {
        const { context } = setup(null);
        expect(await isPassiveChannel(context as never, 'g1', 'c1')).toBe(false);
    });

    it('is false, not thrown, when the stored value is corrupt', async () => {
        const { context } = setup('not json');
        expect(await isPassiveChannel(context as never, 'g1', 'c1')).toBe(false);
    });

    it.each(['true', '{}', '42'])(
        'is false, not thrown, when the stored value parses to a non-array (%s)',
        async value => {
            const { context } = setup(value);
            await expect(isPassiveChannel(context as never, 'g1', 'c1')).resolves.toBe(false);
        },
    );

    it('reads the database once per guild while the cache is warm', async () => {
        const { context, table } = setup(JSON.stringify(['c1']));
        await isPassiveChannel(context as never, 'g1', 'c1');
        await isPassiveChannel(context as never, 'g1', 'c1');
        expect(table.findOne).toHaveBeenCalledTimes(1);
    });

    it('is false when the lookup throws', async () => {
        const { context, table } = setup(null);
        table.findOne.mockRejectedValue(new Error('db down'));
        expect(await isPassiveChannel(context as never, 'g1', 'c1')).toBe(false);
    });

    describe('cache expiry', () => {
        afterEach(() => {
            jest.useRealTimers();
        });

        it('reads the database again after the TTL elapses', async () => {
            jest.useFakeTimers();
            const { context, table } = setup(JSON.stringify(['c1']));

            await isPassiveChannel(context as never, 'g1', 'c1');
            jest.advanceTimersByTime(61_000);
            await isPassiveChannel(context as never, 'g1', 'c1');

            expect(table.findOne).toHaveBeenCalledTimes(2);
        });
    });
});

describe('setPassiveChannel', () => {
    beforeEach(() => clearPassiveChannelCache());

    it('adds a channel and invalidates the cache', async () => {
        const { context, table } = setup(JSON.stringify(['c1']));

        // Warm the cache before writing.
        expect(await isPassiveChannel(context as never, 'g1', 'c1')).toBe(true);
        expect(table.findOne).toHaveBeenCalledTimes(1);

        table.findOne.mockResolvedValue({ key: 'k', value: JSON.stringify(['c1', 'c2']) });
        await setPassiveChannel(context as never, 'g1', 'c2', true);

        expect(table.upsert).toHaveBeenCalledWith({
            key: 'passive_qa_channels_g1',
            value: JSON.stringify(['c1', 'c2']),
        });

        // The cache must be invalidated: the next read has to go back to the
        // database rather than serve the stale pre-write list.
        expect(await isPassiveChannel(context as never, 'g1', 'c2')).toBe(true);
        expect(table.findOne).toHaveBeenCalledTimes(2);
    });

    it('removes a channel', async () => {
        const { context, table } = setup(JSON.stringify(['c1', 'c2']));
        await setPassiveChannel(context as never, 'g1', 'c1', false);

        expect(table.upsert).toHaveBeenCalledWith({
            key: 'passive_qa_channels_g1',
            value: JSON.stringify(['c2']),
        });
    });

    it('does not duplicate a channel already enabled', async () => {
        const { context, table } = setup(JSON.stringify(['c1']));
        await setPassiveChannel(context as never, 'g1', 'c1', true);

        expect(table.upsert).toHaveBeenCalledWith({
            key: 'passive_qa_channels_g1',
            value: JSON.stringify(['c1']),
        });
    });
});
