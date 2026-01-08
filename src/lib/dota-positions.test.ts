import { HERO_POSITIONS, getHeroPositions, getHeroesForPosition } from './dota-positions';

describe('Dota Hero Positions', () => {
    describe('HERO_POSITIONS constant', () => {
        it('should contain position mappings for heroes', () => {
            expect(Object.keys(HERO_POSITIONS).length).toBeGreaterThan(100);
        });

        it('should have valid position values', () => {
            const validPositions = ['pos1', 'pos2', 'pos3', 'pos4', 'pos5'];

            for (const [, positions] of Object.entries(HERO_POSITIONS)) {
                expect(Array.isArray(positions)).toBe(true);
                expect(positions.length).toBeGreaterThan(0);

                for (const pos of positions) {
                    expect(validPositions).toContain(pos);
                }
            }
        });

        it('should have Anti-Mage as pos1 only', () => {
            expect(HERO_POSITIONS['Anti-Mage']).toEqual(['pos1']);
        });

        it('should have Abaddon as flex support/offlane', () => {
            expect(HERO_POSITIONS['Abaddon']).toEqual(['pos3', 'pos4', 'pos5']);
        });
    });

    describe('getHeroPositions', () => {
        it('should return positions for a known hero', () => {
            const positions = getHeroPositions('Axe');
            expect(positions).toEqual(['pos3']);
        });

        it('should return multiple positions for flex heroes', () => {
            const positions = getHeroPositions('Crystal Maiden');
            expect(positions).toEqual(['pos4', 'pos5']);
        });

        it('should return empty array for unknown hero', () => {
            const positions = getHeroPositions('Unknown Hero');
            expect(positions).toEqual([]);
        });

        it('should be case sensitive', () => {
            const positions = getHeroPositions('axe');
            expect(positions).toEqual([]);
        });
    });

    describe('getHeroesForPosition', () => {
        it('should return heroes for pos1 (carry)', () => {
            const carries = getHeroesForPosition('pos1');
            expect(carries).toContain('Anti-Mage');
            expect(carries).toContain('Phantom Assassin');
            expect(carries).toContain('Spectre');
        });

        it('should return heroes for pos2 (mid)', () => {
            const mids = getHeroesForPosition('pos2');
            expect(mids).toContain('Invoker');
            expect(mids).toContain('Storm Spirit');
            expect(mids).toContain('Queen of Pain');
        });

        it('should return heroes for pos5 (hard support)', () => {
            const hardSupports = getHeroesForPosition('pos5');
            expect(hardSupports).toContain('Crystal Maiden');
            expect(hardSupports).toContain('Lion');
            expect(hardSupports).toContain('Shadow Shaman');
        });

        it('should return empty array for invalid position', () => {
            const heroes = getHeroesForPosition('pos6');
            expect(heroes).toEqual([]);
        });

        it('should include flex heroes in multiple positions', () => {
            const pos3Heroes = getHeroesForPosition('pos3');
            const pos4Heroes = getHeroesForPosition('pos4');

            // Abaddon can play both pos3 and pos4
            expect(pos3Heroes).toContain('Abaddon');
            expect(pos4Heroes).toContain('Abaddon');
        });
    });
});
