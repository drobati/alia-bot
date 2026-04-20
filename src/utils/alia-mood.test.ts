import {
    getDailySeed,
    getTodaysMood,
    getTimeOfDay,
    getMoodPromptBlock,
    getTimeOfDayBlock,
    Mood,
    TimeOfDay,
} from './alia-mood';

describe('alia-mood', () => {
    describe('getDailySeed', () => {
        it('returns the same seed for the same calendar day', () => {
            const a = new Date(2026, 3, 20, 9, 0, 0);
            const b = new Date(2026, 3, 20, 23, 59, 59);
            expect(getDailySeed(a)).toBe(getDailySeed(b));
        });

        it('returns different seeds for different days', () => {
            const a = new Date(2026, 3, 20);
            const b = new Date(2026, 3, 21);
            expect(getDailySeed(a)).not.toBe(getDailySeed(b));
        });
    });

    describe('getTodaysMood', () => {
        it('returns the same mood for the same day', () => {
            const a = new Date(2026, 3, 20, 9, 0, 0);
            const b = new Date(2026, 3, 20, 22, 0, 0);
            expect(getTodaysMood(a)).toBe(getTodaysMood(b));
        });

        it('returns a valid mood', () => {
            const valid: Mood[] = ['feisty', 'sassy', 'chill', 'wholesome', 'grumpy', 'chaotic'];
            for (let day = 1; day <= 31; day++) {
                const date = new Date(2026, 3, day);
                expect(valid).toContain(getTodaysMood(date));
            }
        });

        it('produces a reasonable mood distribution over a year', () => {
            const counts: Record<Mood, number> = {
                feisty: 0, sassy: 0, chill: 0, wholesome: 0, grumpy: 0, chaotic: 0,
            };
            for (let d = 0; d < 365; d++) {
                const date = new Date(2026, 0, 1 + d);
                counts[getTodaysMood(date)]++;
            }
            for (const count of Object.values(counts)) {
                expect(count).toBeGreaterThan(0);
            }
        });
    });

    describe('getTimeOfDay', () => {
        it.each<[number, TimeOfDay]>([
            [6, 'morning'],
            [11, 'morning'],
            [12, 'afternoon'],
            [17, 'afternoon'],
            [18, 'evening'],
            [22, 'evening'],
            [23, 'late-night'],
            [2, 'late-night'],
            [4, 'late-night'],
        ])('hour %i maps to %s', (hour, expected) => {
            const d = new Date(2026, 3, 20, hour, 30);
            expect(getTimeOfDay(d)).toBe(expected);
        });
    });

    describe('prompt blocks', () => {
        it('returns a non-empty block for every mood', () => {
            const moods: Mood[] = ['feisty', 'sassy', 'chill', 'wholesome', 'grumpy', 'chaotic'];
            for (const m of moods) {
                expect(getMoodPromptBlock(m).length).toBeGreaterThan(20);
            }
        });

        it('returns a non-empty block for every time-of-day', () => {
            const tods: TimeOfDay[] = ['morning', 'afternoon', 'evening', 'late-night'];
            for (const t of tods) {
                expect(getTimeOfDayBlock(t).length).toBeGreaterThan(10);
            }
        });
    });
});
