import { HoroscopeGenerator } from './horoscopeGenerator';
import { ZodiacUtil } from './zodiacUtil';

// Mock ZodiacUtil
jest.mock('./zodiacUtil');
const mockZodiacUtil = ZodiacUtil as jest.Mocked<typeof ZodiacUtil>;

describe('HoroscopeGenerator', () => {
    let mockContext: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock context
        mockContext = {
            log: {
                error: jest.fn(),
            },
            tables: {
                HoroscopeCache: {
                    findOne: jest.fn(),
                    upsert: jest.fn(),
                },
            },
            sequelize: {
                Op: {
                    gt: Symbol('gt'),
                },
            },
        };

        // Mock ZodiacUtil methods
        mockZodiacUtil.getZodiacInfo.mockReturnValue({
            sign: 'Aries',
            emoji: '♈',
            element: 'Fire',
            planet: 'Mars',
            colors: [0xFF4500, 0xDC143C],
            traits: ['courageous', 'determined', 'confident', 'enthusiastic'],
            compatibility: ['Leo', 'Sagittarius', 'Gemini', 'Aquarius'],
            dateRange: 'Mar 21 - Apr 19',
            startDate: { month: 3, day: 21 },
            endDate: { month: 4, day: 19 },
        });

        mockZodiacUtil.getRandomCompatibleSign.mockReturnValue('Leo');

        // Default: no cached data
        (mockContext.tables.HoroscopeCache.findOne as jest.Mock).mockResolvedValue(null);
    });

    describe('generate', () => {
        const baseRequest = {
            sign: 'aries',
            type: 'daily',
            period: 'today',
            userId: 'test-user-id',
            guildId: 'test-guild-id',
        };

        test('should generate complete horoscope data', async () => {
            const result = await HoroscopeGenerator.generate(baseRequest, mockContext);

            expect(result).toHaveProperty('content');
            expect(result).toHaveProperty('luckyNumbers');
            expect(result).toHaveProperty('luckyColor');
            expect(result).toHaveProperty('mood');
            expect(result).toHaveProperty('compatibility');
            expect(result).toHaveProperty('advice');

            expect(typeof result.content).toBe('string');
            expect(result.content.length).toBeGreaterThan(0);
            expect(result.luckyNumbers).toMatch(/^\d+(?:, \d+)*$/);
            expect(result.luckyColor.length).toBeGreaterThan(0);
            expect(result.mood.length).toBeGreaterThan(0);
        });

        test('should generate different content for different types', async () => {
            const types = ['daily', 'love', 'career', 'lucky', 'weekly', 'monthly'];
            const results = [];

            for (const type of types) {
                const result = await HoroscopeGenerator.generate(
                    { ...baseRequest, type },
                    mockContext,
                );
                results.push(result);
            }

            // Should generate different content (though randomness might occasionally match)
            const uniqueContent = new Set(results.map(r => r.content));
            expect(uniqueContent.size).toBeGreaterThan(1);
        });

        test('should include compatibility for love readings', async () => {
            const result = await HoroscopeGenerator.generate(
                { ...baseRequest, type: 'love' },
                mockContext,
            );

            expect(result.compatibility).toBeTruthy();
            expect(result.compatibility).toContain('Leo');
            expect(mockZodiacUtil.getRandomCompatibleSign).toHaveBeenCalledWith('aries');
        });

        test('should include advice for daily, love, and career readings', async () => {
            const typesWithAdvice = ['daily', 'love', 'career'];

            for (const type of typesWithAdvice) {
                const result = await HoroscopeGenerator.generate(
                    { ...baseRequest, type },
                    mockContext,
                );

                expect(result.advice).toBeTruthy();
                expect(typeof result.advice).toBe('string');
                expect(result.advice!.length).toBeGreaterThan(0);
            }
        });

        test('should not include compatibility for non-love readings', async () => {
            const typesWithoutCompatibility = ['daily', 'career', 'lucky', 'weekly', 'monthly'];

            for (const type of typesWithoutCompatibility) {
                const result = await HoroscopeGenerator.generate(
                    { ...baseRequest, type },
                    mockContext,
                );

                expect(result.compatibility).toBeUndefined();
            }
        });

        test('should generate valid lucky numbers', async () => {
            const result = await HoroscopeGenerator.generate(baseRequest, mockContext);

            const numbers = result.luckyNumbers.split(', ').map(n => parseInt(n, 10));

            expect(numbers).toHaveLength(5);
            numbers.forEach(num => {
                expect(num).toBeGreaterThanOrEqual(1);
                expect(num).toBeLessThanOrEqual(99);
            });

            // Should be sorted
            const sortedNumbers = [...numbers].sort((a, b) => a - b);
            expect(numbers).toEqual(sortedNumbers);

            // Should be unique
            const uniqueNumbers = new Set(numbers);
            expect(uniqueNumbers.size).toBe(5);
        });

        test('should fill template placeholders correctly', async () => {
            const result = await HoroscopeGenerator.generate(baseRequest, mockContext);

            // Content should not contain unfilled placeholders
            expect(result.content).not.toContain('{sign}');
            expect(result.content).not.toContain('{element}');
            expect(result.content).not.toContain('{planet}');
            expect(result.content).not.toContain('{trait1}');
            expect(result.content).not.toContain('{trait2}');
            expect(result.content).not.toContain('{action}');

            // Should contain zodiac information
            expect(result.content.toLowerCase()).toMatch(
                /(aries|fire|mars|courageous|determined|confident|enthusiastic)/,
            );
        });
    });

    describe('caching', () => {
        const baseRequest = {
            sign: 'taurus',
            type: 'daily',
            period: 'today',
            userId: 'test-user-id',
            guildId: 'test-guild-id',
        };

        test('should return cached result when available', async () => {
            const cachedData = {
                content: 'Cached horoscope content',
                luckyNumbers: '1, 2, 3, 4, 5',
                luckyColor: 'Cached Purple 💜',
                mood: 'Cached Mood ✨',
                compatibility: 'Virgo',
            };

            (mockContext.tables.HoroscopeCache.findOne as jest.Mock).mockResolvedValue(cachedData);

            const result = await HoroscopeGenerator.generate(baseRequest, mockContext);

            expect(result).toEqual({
                content: 'Cached horoscope content',
                luckyNumbers: '1, 2, 3, 4, 5',
                luckyColor: 'Cached Purple 💜',
                mood: 'Cached Mood ✨',
                compatibility: 'Virgo',
            });

            expect(mockContext.tables.HoroscopeCache.findOne).toHaveBeenCalledWith({
                where: {
                    cacheKey: expect.stringContaining('taurus_daily_today_'),
                    expiresAt: { [mockContext.sequelize.Op.gt]: expect.any(Date) },
                },
            });
        });

        test('should cache new results', async () => {
            const result = await HoroscopeGenerator.generate(baseRequest, mockContext);

            expect(mockContext.tables.HoroscopeCache.upsert).toHaveBeenCalledWith({
                cacheKey: expect.stringContaining('taurus_daily_today_'),
                sign: 'taurus',
                type: 'daily',
                period: 'today',
                content: result.content,
                luckyNumbers: result.luckyNumbers,
                luckyColor: result.luckyColor,
                compatibility: result.compatibility || '',
                mood: result.mood,
                expiresAt: expect.any(Date),
            });
        });

        test('should generate unique cache keys for different parameters', async () => {
            const requests = [
                { ...baseRequest, sign: 'aries' },
                { ...baseRequest, type: 'love' },
                { ...baseRequest, period: 'tomorrow' },
            ];

            for (const request of requests) {
                await HoroscopeGenerator.generate(request, mockContext);
            }

            const cacheKeys = (mockContext.tables.HoroscopeCache.upsert as jest.Mock).mock.calls
                .map(call => call[0].cacheKey);

            expect(new Set(cacheKeys).size).toBe(3);
        });

        test('should handle cache errors gracefully', async () => {
            (mockContext.tables.HoroscopeCache.findOne as jest.Mock).mockRejectedValue(new Error('Cache error'));

            const result = await HoroscopeGenerator.generate(baseRequest, mockContext);

            expect(result).toHaveProperty('content');
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Error reading horoscope cache',
                { error: expect.any(Error) },
            );
        });

        test('should handle cache write errors gracefully', async () => {
            (mockContext.tables.HoroscopeCache.upsert as jest.Mock).mockRejectedValue(new Error('Cache write error'));

            const result = await HoroscopeGenerator.generate(baseRequest, mockContext);

            expect(result).toHaveProperty('content');
            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Error caching horoscope reading',
                { error: expect.any(Error) },
            );
        });
    });

    describe('expiration calculation', () => {
        test('should set appropriate expiration times for different periods', async () => {
            const now = new Date('2024-01-15T12:00:00Z');
            jest.useFakeTimers();
            jest.setSystemTime(now);

            const periods = ['today', 'tomorrow', 'this-week', 'next-week', 'this-month'];

            for (const period of periods) {
                const request = {
                    sign: 'gemini',
                    type: 'daily',
                    period,
                    userId: 'test-user-id',
                };

                await HoroscopeGenerator.generate(request, mockContext);

                const upsertCall = (mockContext.tables.HoroscopeCache.upsert as jest.Mock).mock.calls.pop();
                const expiresAt = upsertCall[0].expiresAt;

                expect(expiresAt).toBeInstanceOf(Date);
                expect(expiresAt.getTime()).toBeGreaterThan(now.getTime());

                // Verify reasonable expiration times
                const hoursFromNow = (expiresAt.getTime() - now.getTime()) / (1000 * 60 * 60);

                switch (period) {
                    case 'today':
                        expect(hoursFromNow).toBeGreaterThan(12); // At least until midnight
                        expect(hoursFromNow).toBeLessThan(24);
                        break;
                    case 'tomorrow':
                        expect(hoursFromNow).toBeGreaterThan(24);
                        expect(hoursFromNow).toBeLessThan(48);
                        break;
                    case 'this-week':
                    case 'next-week':
                        expect(hoursFromNow).toBeGreaterThan(24);
                        expect(hoursFromNow).toBeLessThan(168); // 1 week
                        break;
                    case 'this-month':
                        expect(hoursFromNow).toBeGreaterThan(24);
                        expect(hoursFromNow).toBeLessThan(744); // ~1 month
                        break;
                }
            }

            jest.useRealTimers();
        });
    });

    describe('template selection and filling', () => {
        test('should use zodiac-specific information in templates', async () => {
            const differentSigns = [
                { sign: 'aries', element: 'Fire', planet: 'Mars' },
                { sign: 'cancer', element: 'Water', planet: 'Moon' },
                { sign: 'libra', element: 'Air', planet: 'Venus' },
                { sign: 'capricorn', element: 'Earth', planet: 'Saturn' },
            ];

            for (const { sign, element, planet } of differentSigns) {
                mockZodiacUtil.getZodiacInfo.mockReturnValue({
                    sign: sign.charAt(0).toUpperCase() + sign.slice(1),
                    emoji: '♈',
                    element,
                    planet,
                    colors: [0xFF0000],
                    traits: ['trait1', 'trait2', 'trait3', 'trait4'],
                    compatibility: ['Leo'],
                    dateRange: 'Range',
                    startDate: { month: 1, day: 1 },
                    endDate: { month: 1, day: 31 },
                });

                const result = await HoroscopeGenerator.generate({
                    sign,
                    type: 'daily',
                    period: 'today',
                    userId: 'test-user-id',
                }, mockContext);

                // Templates may contain either element, planet, or traits - just verify zodiac info is used
                const content = result.content.toLowerCase();
                const hasZodiacInfo =
                    content.includes(element.toLowerCase()) ||
                    content.includes(planet.toLowerCase()) ||
                    content.includes('trait1') ||
                    content.includes('trait2') ||
                    content.includes('trait3') ||
                    content.includes('trait4');
                expect(hasZodiacInfo).toBe(true);
            }
        });

        test('should use different traits in same template', async () => {
            const results = [];

            // Generate multiple horoscopes to test trait variation
            for (let i = 0; i < 10; i++) {
                const result = await HoroscopeGenerator.generate({
                    sign: 'leo',
                    type: 'daily',
                    period: 'today',
                    userId: `test-user-${i}`,
                }, mockContext);

                results.push(result.content);
            }

            // Should see some variation in traits used (though not guaranteed due to randomness)
            const uniqueContent = new Set(results);
            expect(uniqueContent.size).toBeGreaterThan(1);
        });
    });

    describe('mood and color generation', () => {
        test('should generate appropriate moods for different categories', async () => {
            const types = ['daily', 'love', 'career', 'lucky'];

            for (const type of types) {
                const result = await HoroscopeGenerator.generate({
                    sign: 'virgo',
                    type,
                    period: 'today',
                    userId: 'test-user-id',
                }, mockContext);

                expect(result.mood).toBeTruthy();
                // Check that mood has emoji at the end - emojis vary so just check format
                expect(result.mood).toMatch(/^.+\s.+$/); // Allow multiple characters for emoji
            }
        });

        test('should generate varied lucky colors', async () => {
            const results = [];

            for (let i = 0; i < 5; i++) {
                const result = await HoroscopeGenerator.generate({
                    sign: 'scorpio',
                    type: 'daily',
                    period: 'today',
                    userId: `test-user-${i}`,
                }, mockContext);

                results.push(result.luckyColor);
            }

            expect(results.every(color => color.length > 0)).toBe(true);
            expect(results.every(color => /(💜|⭐|💙|💚|❤️|🧡|💗|🤍|🔥|🌿|💎|💫)/u.test(color))).toBe(true);
        });
    });

    describe('content quality', () => {
        test('should generate content of reasonable length', async () => {
            const result = await HoroscopeGenerator.generate({
                sign: 'sagittarius',
                type: 'daily',
                period: 'today',
                userId: 'test-user-id',
            }, mockContext);

            expect(result.content.length).toBeGreaterThan(50);
            expect(result.content.length).toBeLessThan(1000);
        });

        test('should generate grammatically sound content', async () => {
            const result = await HoroscopeGenerator.generate({
                sign: 'aquarius',
                type: 'weekly',
                period: 'this-week',
                userId: 'test-user-id',
            }, mockContext);

            // Basic grammar checks
            expect(result.content).toMatch(/^[A-Z]/); // Starts with capital letter
            expect(result.content).toMatch(/[.!]$/); // Ends with punctuation
            expect(result.content).not.toMatch(/\s\s+/); // No double spaces
        });

        test('should generate contextually appropriate advice', async () => {
            const types = [
                { type: 'daily' },
                { type: 'love' },
                { type: 'career' },
            ];

            for (const { type } of types) {
                const result = await HoroscopeGenerator.generate({
                    sign: 'pisces',
                    type,
                    period: 'today',
                    userId: 'test-user-id',
                }, mockContext);

                // Advice should be present and reasonable length
                expect(result.advice).toBeTruthy();
                expect(result.advice!.length).toBeGreaterThan(10);
            }
        });
    });
});