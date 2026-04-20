import {
    classifyTier,
    getInteractionInfo,
    bumpInteraction,
    describeRelationship,
} from './alia-relationships';

describe('alia-relationships', () => {
    describe('classifyTier', () => {
        it('classifies 0 as stranger', () => expect(classifyTier(0)).toBe('stranger'));
        it('classifies 2 as stranger', () => expect(classifyTier(2)).toBe('stranger'));
        it('classifies 3 as acquaintance', () => expect(classifyTier(3)).toBe('acquaintance'));
        it('classifies 19 as acquaintance', () => expect(classifyTier(19)).toBe('acquaintance'));
        it('classifies 20 as regular', () => expect(classifyTier(20)).toBe('regular'));
        it('classifies 500 as regular', () => expect(classifyTier(500)).toBe('regular'));
    });

    describe('getInteractionInfo', () => {
        it('returns zero-state for unknown user', async () => {
            const tables = {
                UserInteractions: { findOne: jest.fn().mockResolvedValue(null) },
            } as any;
            const info = await getInteractionInfo(tables, 'g', 'u');
            expect(info).toEqual({
                count: 0, tier: 'stranger', lastInteractionAt: null, hoursSinceLast: null,
            });
        });

        it('computes tier and hoursSinceLast from row', async () => {
            const twoHoursAgo = new Date(Date.now() - 2 * 60 * 60 * 1000);
            const tables = {
                UserInteractions: {
                    findOne: jest.fn().mockResolvedValue({
                        interaction_count: 25,
                        last_interaction_at: twoHoursAgo,
                    }),
                },
            } as any;
            const info = await getInteractionInfo(tables, 'g', 'u');
            expect(info.count).toBe(25);
            expect(info.tier).toBe('regular');
            expect(info.hoursSinceLast).toBe(2);
        });
    });

    describe('bumpInteraction', () => {
        it('creates a new row for first-time user', async () => {
            const findOrCreate = jest.fn().mockResolvedValue([
                { interaction_count: 1, update: jest.fn() },
                true,
            ]);
            const tables = { UserInteractions: { findOrCreate } } as any;
            await bumpInteraction(tables, 'g', 'u');
            expect(findOrCreate).toHaveBeenCalled();
        });

        it('increments existing row', async () => {
            const update = jest.fn();
            const row = { interaction_count: 5, update };
            const tables = {
                UserInteractions: {
                    findOrCreate: jest.fn().mockResolvedValue([row, false]),
                },
            } as any;
            await bumpInteraction(tables, 'g', 'u');
            expect(update).toHaveBeenCalledWith(expect.objectContaining({
                interaction_count: 6,
            }));
        });
    });

    describe('describeRelationship', () => {
        it('handles never-talked case', () => {
            const s = describeRelationship(
                { count: 0, tier: 'stranger', lastInteractionAt: null, hoursSinceLast: null },
                'Derek',
            );
            expect(s).toMatch(/never talked to Derek/);
        });

        it('mentions recent contact when within 24h', () => {
            const s = describeRelationship(
                { count: 50, tier: 'regular', lastInteractionAt: new Date(), hoursSinceLast: 3 },
                'Derek',
            );
            expect(s).toMatch(/3h ago/);
            expect(s).toMatch(/know them well/);
        });

        it('omits recent contact when over 24h', () => {
            const s = describeRelationship(
                { count: 50, tier: 'regular', lastInteractionAt: new Date(), hoursSinceLast: 72 },
                'Derek',
            );
            expect(s).not.toMatch(/ago/);
        });
    });
});
