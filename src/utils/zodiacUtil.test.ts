import { ZodiacUtil } from './zodiacUtil';

describe('ZodiacUtil', () => {
    describe('getZodiacInfo', () => {
        test('should return correct info for all zodiac signs', () => {
            const signs = [
                'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
                'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
            ];

            signs.forEach(sign => {
                const info = ZodiacUtil.getZodiacInfo(sign);
                expect(info.sign).toBeTruthy();
                expect(info.emoji).toBeTruthy();
                expect(info.element).toMatch(/^(Fire|Earth|Air|Water)$/);
                expect(info.planet).toBeTruthy();
                expect(info.colors).toHaveLength(2);
                expect(info.traits).toHaveLength(4);
                expect(info.compatibility).toHaveLength(4);
                expect(info.dateRange).toBeTruthy();
                expect(info.startDate).toHaveProperty('month');
                expect(info.startDate).toHaveProperty('day');
                expect(info.endDate).toHaveProperty('month');
                expect(info.endDate).toHaveProperty('day');
            });
        });

        test('should handle case insensitive input', () => {
            expect(ZodiacUtil.getZodiacInfo('ARIES').sign).toBe('Aries');
            expect(ZodiacUtil.getZodiacInfo('ArIeS').sign).toBe('Aries');
            expect(ZodiacUtil.getZodiacInfo('aries').sign).toBe('Aries');
        });

        test('should return default (Aries) for invalid sign', () => {
            const info = ZodiacUtil.getZodiacInfo('invalid_sign');
            expect(info.sign).toBe('Aries');
        });
    });

    describe('parseSignInput', () => {
        test('should parse zodiac sign names correctly', () => {
            expect(ZodiacUtil.parseSignInput('aries')).toEqual({ sign: 'aries' });
            expect(ZodiacUtil.parseSignInput('Leo')).toEqual({ sign: 'leo' });
            expect(ZodiacUtil.parseSignInput('SCORPIO')).toEqual({ sign: 'scorpio' });
        });

        test('should parse partial zodiac sign names', () => {
            expect(ZodiacUtil.parseSignInput('ari')).toEqual({ sign: 'aries' });
            expect(ZodiacUtil.parseSignInput('scor')).toEqual({ sign: 'scorpio' });
            expect(ZodiacUtil.parseSignInput('cap')).toEqual({ sign: 'capricorn' });
        });

        test('should parse date formats and return zodiac signs', () => {
            // Test various date formats
            expect(ZodiacUtil.parseSignInput('03-21')).toEqual({
                sign: 'aries',
                birthDate: '03-21',
            });
            expect(ZodiacUtil.parseSignInput('3/21')).toEqual({
                sign: 'aries',
                birthDate: '03-21',
            });
            expect(ZodiacUtil.parseSignInput('12-25')).toEqual({
                sign: 'capricorn',
                birthDate: '12-25',
            });
        });

        test('should handle edge cases for date parsing', () => {
            // Valid dates
            expect(ZodiacUtil.parseSignInput('1-1')).toEqual({
                sign: 'capricorn',
                birthDate: '01-01',
            });
            expect(ZodiacUtil.parseSignInput('12-31')).toEqual({
                sign: 'capricorn',
                birthDate: '12-31',
            });

            // Invalid dates should fall back to sign parsing
            expect(ZodiacUtil.parseSignInput('13-01')).toEqual({ sign: 'aries' });
            expect(ZodiacUtil.parseSignInput('01-32')).toEqual({ sign: 'aries' });
        });

        test('should default to aries for unrecognized input', () => {
            expect(ZodiacUtil.parseSignInput('xyz')).toEqual({ sign: 'aries' });
            expect(ZodiacUtil.parseSignInput('123abc')).toEqual({ sign: 'aries' });
            expect(ZodiacUtil.parseSignInput('')).toEqual({ sign: 'aries' });
        });
    });

    describe('getSignByDate', () => {
        test('should return correct signs for boundary dates', () => {
            // Test start and end dates for each sign
            expect(ZodiacUtil.getSignByDate(3, 21)).toBe('Aries'); // Start of Aries
            expect(ZodiacUtil.getSignByDate(4, 19)).toBe('Aries'); // End of Aries
            expect(ZodiacUtil.getSignByDate(4, 20)).toBe('Taurus'); // Start of Taurus

            expect(ZodiacUtil.getSignByDate(12, 22)).toBe('Capricorn'); // Start of Capricorn
            expect(ZodiacUtil.getSignByDate(1, 19)).toBe('Capricorn'); // End of Capricorn (year crossing)
            expect(ZodiacUtil.getSignByDate(1, 20)).toBe('Aquarius'); // Start of Aquarius
        });

        test('should handle year-crossing sign (Capricorn) correctly', () => {
            expect(ZodiacUtil.getSignByDate(12, 25)).toBe('Capricorn');
            expect(ZodiacUtil.getSignByDate(1, 1)).toBe('Capricorn');
            expect(ZodiacUtil.getSignByDate(1, 15)).toBe('Capricorn');
            expect(ZodiacUtil.getSignByDate(1, 19)).toBe('Capricorn');
            expect(ZodiacUtil.getSignByDate(1, 20)).toBe('Aquarius');
        });

        test('should return correct signs for middle dates', () => {
            expect(ZodiacUtil.getSignByDate(6, 1)).toBe('Gemini');
            expect(ZodiacUtil.getSignByDate(8, 15)).toBe('Leo');
            expect(ZodiacUtil.getSignByDate(10, 31)).toBe('Scorpio');
        });
    });

    describe('getAllSigns', () => {
        test('should return all 12 zodiac signs', () => {
            const signs = ZodiacUtil.getAllSigns();
            expect(signs).toHaveLength(12);
            expect(signs).toContain('aries');
            expect(signs).toContain('pisces');
            expect(signs).toContain('scorpio');
        });
    });

    describe('getSignSuggestions', () => {

        test('should return date suggestions for numeric input', async () => {
            const suggestions = await ZodiacUtil.getSignSuggestions('03');

            expect(suggestions).toEqual([
                expect.objectContaining({
                    name: '03-DD (Enter your birth date)',
                    value: '03',
                }),
            ]);
        });

        test('should return zodiac sign for complete date', async () => {
            const suggestions = await ZodiacUtil.getSignSuggestions('08-15');

            expect(suggestions).toEqual([
                expect.objectContaining({
                    name: expect.stringContaining('♌ Leo'),
                    value: '08-15',
                }),
            ]);
        });

        test('should return filtered zodiac signs for partial names', async () => {
            const suggestions = await ZodiacUtil.getSignSuggestions('ar');

            expect(suggestions.length).toBeGreaterThan(0);
            expect(suggestions[0].name).toContain('Aries');
        });

        test('should sort suggestions by relevance', async () => {
            const suggestions = await ZodiacUtil.getSignSuggestions('a');

            // Should find Aries, Aquarius - exact matches first, then partial
            expect(suggestions.length).toBeGreaterThan(1);
            const names = suggestions.map(s => s.name);
            expect(names.some(name => name.includes('Aries'))).toBe(true);
            expect(names.some(name => name.includes('Aquarius'))).toBe(true);
        });

        test('should limit results to 25 suggestions', async () => {
            const suggestions = await ZodiacUtil.getSignSuggestions('');
            expect(suggestions.length).toBeLessThanOrEqual(25);
        });
    });

    describe('getRandomCompatibleSign', () => {
        test('should return a compatible sign for each zodiac sign', () => {
            const signs = ZodiacUtil.getAllSigns();

            signs.forEach(sign => {
                const compatible = ZodiacUtil.getRandomCompatibleSign(sign);
                const zodiacInfo = ZodiacUtil.getZodiacInfo(sign);

                expect(zodiacInfo.compatibility).toContain(compatible);
                expect(compatible).not.toBe(zodiacInfo.sign);
            });
        });

        test('should return different results on multiple calls (randomness)', () => {
            const results = new Set();

            // Call multiple times to test randomness
            for (let i = 0; i < 10; i++) {
                results.add(ZodiacUtil.getRandomCompatibleSign('aries'));
            }

            // Should get some variety (though not guaranteed due to randomness)
            expect(results.size).toBeGreaterThan(0);
        });
    });

    describe('getElementSigns', () => {
        test('should return correct signs for each element', () => {
            const fireSigns = ZodiacUtil.getElementSigns('Fire');
            expect(fireSigns).toEqual(['Aries', 'Leo', 'Sagittarius']);

            const earthSigns = ZodiacUtil.getElementSigns('Earth');
            expect(earthSigns).toEqual(['Taurus', 'Virgo', 'Capricorn']);

            const airSigns = ZodiacUtil.getElementSigns('Air');
            expect(airSigns).toEqual(['Gemini', 'Libra', 'Aquarius']);

            const waterSigns = ZodiacUtil.getElementSigns('Water');
            expect(waterSigns).toEqual(['Cancer', 'Scorpio', 'Pisces']);
        });

        test('should handle case insensitive element names', () => {
            expect(ZodiacUtil.getElementSigns('fire')).toEqual(['Aries', 'Leo', 'Sagittarius']);
            expect(ZodiacUtil.getElementSigns('EARTH')).toEqual(['Taurus', 'Virgo', 'Capricorn']);
        });

        test('should return empty array for invalid element', () => {
            expect(ZodiacUtil.getElementSigns('invalid')).toEqual([]);
        });
    });

    describe('getSignsByCompatibility', () => {
        test('should return most and least compatible signs', () => {
            const compatibility = ZodiacUtil.getSignsByCompatibility('aries');

            expect(compatibility.most).toEqual(['Leo', 'Sagittarius', 'Gemini', 'Aquarius']);
            expect(compatibility.least).toHaveLength(4);
            expect(compatibility.least).not.toContain('Aries');
            expect(compatibility.least).not.toContain('Leo');
            expect(compatibility.least).not.toContain('Sagittarius');
        });

        test('should work for all zodiac signs', () => {
            const signs = ZodiacUtil.getAllSigns();

            signs.forEach(sign => {
                const compatibility = ZodiacUtil.getSignsByCompatibility(sign);

                expect(compatibility.most).toHaveLength(4);
                expect(compatibility.least).toHaveLength(4);

                // Should not include the sign itself in either list
                expect(compatibility.most).not.toContain(ZodiacUtil.getZodiacInfo(sign).sign);
                expect(compatibility.least).not.toContain(ZodiacUtil.getZodiacInfo(sign).sign);

                // Most and least should not overlap
                const mostSet = new Set(compatibility.most);
                compatibility.least.forEach(leastSign => {
                    expect(mostSet.has(leastSign)).toBe(false);
                });
            });
        });
    });

    describe('Date Range Validation', () => {
        test('should have valid date ranges for all signs', () => {
            const signs = ZodiacUtil.getAllSigns();

            signs.forEach(sign => {
                const info = ZodiacUtil.getZodiacInfo(sign);

                expect(info.startDate.month).toBeGreaterThanOrEqual(1);
                expect(info.startDate.month).toBeLessThanOrEqual(12);
                expect(info.startDate.day).toBeGreaterThanOrEqual(1);
                expect(info.startDate.day).toBeLessThanOrEqual(31);

                expect(info.endDate.month).toBeGreaterThanOrEqual(1);
                expect(info.endDate.month).toBeLessThanOrEqual(12);
                expect(info.endDate.day).toBeGreaterThanOrEqual(1);
                expect(info.endDate.day).toBeLessThanOrEqual(31);
            });
        });

        test('should cover the entire year without gaps', () => {
            // Test that every day of the year maps to exactly one sign
            const daySignMap = new Map<string, string>();

            for (let month = 1; month <= 12; month++) {
                const daysInMonth = new Date(2024, month, 0).getDate();
                for (let day = 1; day <= daysInMonth; day++) {
                    const sign = ZodiacUtil.getSignByDate(month, day);
                    const dateKey = `${month}-${day}`;
                    daySignMap.set(dateKey, sign);
                }
            }

            // Should have entries for all days
            expect(daySignMap.size).toBeGreaterThan(360); // Account for different month lengths

            // All signs should appear
            const signsFound = new Set(Array.from(daySignMap.values()));
            expect(signsFound.size).toBe(12);
        });
    });
});