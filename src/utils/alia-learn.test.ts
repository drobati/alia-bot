import { parseRememberMarkers, persistMarkers } from './alia-learn';

describe('parseRememberMarkers', () => {
    it('extracts a single marker and strips it from text', () => {
        const input = 'Got it. <REMEMBER user_id="123" description="a guitarist"/> Gross.';
        const { markers, cleaned } = parseRememberMarkers(input);
        expect(markers).toEqual([{ userId: '123', description: 'a guitarist' }]);
        expect(cleaned).toBe('Got it. Gross.');
    });

    it('extracts multiple markers', () => {
        const input = '<REMEMBER user_id="1" description="foo"/><REMEMBER user_id="2" description="bar"/>Hey';
        const { markers, cleaned } = parseRememberMarkers(input);
        expect(markers).toHaveLength(2);
        expect(cleaned).toBe('Hey');
    });

    it('returns empty markers when none present', () => {
        const { markers, cleaned } = parseRememberMarkers('Just a reply.');
        expect(markers).toEqual([]);
        expect(cleaned).toBe('Just a reply.');
    });

    it('handles marker with or without self-closing slash', () => {
        const input = '<REMEMBER user_id="1" description="foo">and<REMEMBER user_id="2" description="bar"/>done';
        const { markers } = parseRememberMarkers(input);
        expect(markers).toHaveLength(2);
    });

    it('is case-insensitive on the tag name', () => {
        const { markers } = parseRememberMarkers('<remember user_id="1" description="foo"/>');
        expect(markers).toHaveLength(1);
    });

    it('rejects descriptions that are too long', () => {
        const longDesc = 'x'.repeat(201);
        const input = `<REMEMBER user_id="1" description="${longDesc}"/>`;
        const { markers, cleaned } = parseRememberMarkers(input);
        expect(markers).toHaveLength(0);
        expect(cleaned).toBe('');
    });

    it('rejects empty descriptions', () => {
        const { markers } = parseRememberMarkers('<REMEMBER user_id="1" description=" "/>');
        expect(markers).toHaveLength(0);
    });
});

describe('persistMarkers', () => {
    function buildContext() {
        return {
            tables: {
                UserDescriptions: {
                    findOrCreate: jest.fn().mockResolvedValue([{}, true]),
                },
            },
            log: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() },
        } as any;
    }

    it('persists markers for allowed user IDs', async () => {
        const ctx = buildContext();
        const saved = await persistMarkers(
            ctx,
            [{ userId: '1', description: 'foo' }, { userId: '2', description: 'bar' }],
            'g1',
            'speaker',
            new Set(['1', '2']),
        );
        expect(saved).toBe(2);
        expect(ctx.tables.UserDescriptions.findOrCreate).toHaveBeenCalledTimes(2);
    });

    it('rejects markers for user IDs not in the allowed set', async () => {
        const ctx = buildContext();
        const saved = await persistMarkers(
            ctx,
            [{ userId: '999', description: 'spoofed' }],
            'g1',
            'speaker',
            new Set(['1', '2']),
        );
        expect(saved).toBe(0);
        expect(ctx.tables.UserDescriptions.findOrCreate).not.toHaveBeenCalled();
        expect(ctx.log.warn).toHaveBeenCalled();
    });

    it('continues after a single failure', async () => {
        const ctx = buildContext();
        ctx.tables.UserDescriptions.findOrCreate
            .mockRejectedValueOnce(new Error('db'))
            .mockResolvedValueOnce([{}, true]);
        const saved = await persistMarkers(
            ctx,
            [{ userId: '1', description: 'foo' }, { userId: '2', description: 'bar' }],
            'g1',
            'speaker',
            new Set(['1', '2']),
        );
        expect(saved).toBe(1);
    });

    it('returns 0 for empty marker list', async () => {
        const ctx = buildContext();
        const saved = await persistMarkers(ctx, [], 'g1', 'speaker', new Set());
        expect(saved).toBe(0);
    });
});
