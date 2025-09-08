import horoscopeCommand from './horoscope';
import { ZodiacUtil } from '../utils/zodiacUtil';
import { HoroscopeGenerator } from '../utils/horoscopeGenerator';

// Mock dependencies
jest.mock('../utils/zodiacUtil');
jest.mock('../utils/horoscopeGenerator');

const mockZodiacUtil = ZodiacUtil as jest.Mocked<typeof ZodiacUtil>;
const mockHoroscopeGenerator = HoroscopeGenerator as jest.Mocked<typeof HoroscopeGenerator>;

describe('Horoscope Command', () => {
    let mockInteraction: any;
    let mockContext: any;

    beforeEach(() => {
        // Reset all mocks
        jest.clearAllMocks();

        // Mock interaction
        mockInteraction = {
            user: {
                id: 'test-user-id',
                username: 'testuser',
            },
            guild: {
                id: 'test-guild-id',
                name: 'Test Guild',
            },
            options: {
                getString: jest.fn(),
                getBoolean: jest.fn().mockReturnValue(false),
                getFocused: jest.fn(),
            },
            deferReply: jest.fn().mockImplementation(() => {
                mockInteraction.deferred = true;
                return Promise.resolve();
            }),
            editReply: jest.fn().mockResolvedValue(undefined),
            reply: jest.fn().mockResolvedValue(undefined),
            respond: jest.fn().mockResolvedValue(undefined),
            deferred: false,
        };

        // Mock context
        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
            },
            tables: {
                HoroscopeUser: {
                    findOne: jest.fn(),
                    upsert: jest.fn(),
                },
                Config: {
                    findOne: jest.fn(),
                    upsert: jest.fn(),
                },
                HoroscopeCache: {
                    findOne: jest.fn(),
                    upsert: jest.fn(),
                },
            },
            sequelize: {
                literal: jest.fn().mockReturnValue('MOCK_LITERAL'),
                Op: {
                    gt: Symbol('gt'),
                },
            },
        };

        // Set up default mock return values - will be overridden in individual tests
        mockZodiacUtil.getAllSigns.mockReturnValue([
            'aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
            'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces',
        ]);

        // Set up dynamic zodiac info mocking
        mockZodiacUtil.getZodiacInfo.mockImplementation((sign: string) => {
            const signData: { [key: string]: any } = {
                'aries': {
                    sign: 'Aries', emoji: '♈', element: 'Fire', planet: 'Mars',
                    colors: [0xFF4500], traits: ['courageous'], compatibility: ['Leo'], dateRange: 'Mar 21 - Apr 19',
                },
                'leo': {
                    sign: 'Leo', emoji: '♌', element: 'Fire', planet: 'Sun',
                    colors: [0xFFD700], traits: ['confident'], compatibility: ['Aries'], dateRange: 'Jul 23 - Aug 22',
                },
                'cancer': {
                    sign: 'Cancer', emoji: '♋', element: 'Water', planet: 'Moon',
                    colors: [0x87CEEB], traits: ['nurturing'], compatibility: ['Scorpio'], dateRange: 'Jun 21 - Jul 22',
                },
                'scorpio': {
                    sign: 'Scorpio', emoji: '♏', element: 'Water', planet: 'Pluto',
                    colors: [0x8B0000], traits: ['intense'], compatibility: ['Cancer'], dateRange: 'Oct 23 - Nov 21',
                },
                'virgo': {
                    sign: 'Virgo', emoji: '♍', element: 'Earth', planet: 'Mercury',
                    colors: [0x9ACD32], traits: ['analytical'], compatibility: ['Taurus'], dateRange: 'Aug 23 - Sep 22',
                },
                'aquarius': {
                    sign: 'Aquarius', emoji: '♒', element: 'Air', planet: 'Uranus',
                    colors: [0x00FFFF], traits: ['innovative'], compatibility: ['Gemini'], dateRange: 'Jan 20 - Feb 18',
                },
            };
            return signData[sign.toLowerCase()] || signData['aries'];
        });

        mockHoroscopeGenerator.generate.mockResolvedValue({
            content: 'Test horoscope content for Aries today.',
            luckyNumbers: '7, 14, 21, 28, 35',
            luckyColor: 'Stellar Gold ⭐',
            mood: 'Radiant ✨',
            compatibility: 'Leo',
            advice: 'Trust your instincts today.',
        });

        (mockContext.tables.HoroscopeUser.findOne as jest.Mock).mockResolvedValue(null);
        (mockContext.tables.Config.findOne as jest.Mock).mockResolvedValue(null);
    });

    describe('Command Structure', () => {
        test('should have correct command data', () => {
            expect(horoscopeCommand.data.name).toBe('horoscope');
            expect(horoscopeCommand.data.description).toBe('Get your personalized horoscope reading');
        });

        test('should have all required options', () => {
            const options = horoscopeCommand.data.options;

            expect(options).toHaveLength(4);

            const signOption = options.find((opt: any) => opt.name === 'sign') as any;
            expect(signOption).toBeDefined();
            expect(signOption?.autocomplete).toBe(true);

            const typeOption = options.find((opt: any) => opt.name === 'type') as any;
            expect(typeOption).toBeDefined();
            if (typeOption && 'choices' in typeOption) {
                const choices = typeOption.choices as any[];
                expect(choices).toHaveLength(6);
                expect(choices.some((c: any) => c.value === 'daily')).toBe(true);
                expect(choices.some((c: any) => c.value === 'love')).toBe(true);
            }

            const periodOption = options.find((opt: any) => opt.name === 'period') as any;
            expect(periodOption).toBeDefined();
            if (periodOption && 'choices' in periodOption) {
                const choices = periodOption.choices as any[];
                expect(choices).toHaveLength(5);
                expect(choices.some((c: any) => c.value === 'today')).toBe(true);
            }

            const publicOption = options.find((opt: any) => opt.name === 'public');
            expect(publicOption).toBeDefined();
        });
    });

    describe('Autocomplete', () => {
        test('should handle sign autocomplete with suggestions', async () => {
            mockInteraction.options.getFocused.mockReturnValue({
                name: 'sign',
                value: 'ari',
            });

            const mockSuggestions = [
                { name: '♈ Aries (Mar 21 - Apr 19)', value: 'aries' },
                { name: '♒ Aquarius (Jan 20 - Feb 18)', value: 'aquarius' },
            ];
            mockZodiacUtil.getSignSuggestions.mockResolvedValue(mockSuggestions);

            await horoscopeCommand.autocomplete(mockInteraction, mockContext);

            expect(mockZodiacUtil.getSignSuggestions).toHaveBeenCalledWith('ari');
            expect(mockInteraction.respond).toHaveBeenCalledWith(mockSuggestions.slice(0, 25));
        });

        test('should handle autocomplete errors gracefully', async () => {
            mockInteraction.options.getFocused.mockReturnValue({
                name: 'sign',
                value: 'test',
            });

            mockZodiacUtil.getSignSuggestions.mockRejectedValue(new Error('API Error'));

            await horoscopeCommand.autocomplete(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith('Horoscope autocomplete error', expect.any(Object));
            expect(mockInteraction.respond).toHaveBeenCalledWith([]);
        });
    });

    describe('Sign Validation', () => {
        test('should reject invalid zodiac sign', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'invalidSign';}
                if (param === 'type') {return null;}
                if (param === 'period') {return null;}
                return null;
            });

            mockZodiacUtil.getZodiacInfo.mockReturnValue({
                sign: 'Aries', // Default fallback
                emoji: '♈',
                element: 'Fire',
                planet: 'Mars',
                colors: [0xFF4500],
                traits: ['courageous'],
                compatibility: ['Leo'],
                dateRange: 'Mar 21 - Apr 19',
                startDate: { month: 3, day: 21 },
                endDate: { month: 4, day: 19 },
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: expect.stringContaining('❌ "invalidSign" is not a valid zodiac sign'),
            });
        });

        test('should accept case insensitive zodiac sign input', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'LEO';}
                if (param === 'type') {return 'love';}
                if (param === 'period') {return 'today';}
                return null;
            });

            mockZodiacUtil.getZodiacInfo.mockReturnValue({
                sign: 'Leo',
                emoji: '♌',
                element: 'Fire',
                planet: 'Sun',
                colors: [0xFFD700],
                traits: ['confident', 'generous'],
                compatibility: ['Aries', 'Sagittarius'],
                dateRange: 'Jul 23 - Aug 22',
                startDate: { month: 7, day: 23 },
                endDate: { month: 8, day: 22 },
            });

            mockHoroscopeGenerator.generate.mockResolvedValue({
                content: 'Test horoscope content',
                luckyNumbers: '7, 14, 21',
                luckyColor: 'Golden Amber 🧡',
                mood: 'Passionate 🔥',
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockHoroscopeGenerator.generate).toHaveBeenCalledWith({
                sign: 'leo',
                type: 'love',
                period: 'today',
                userId: 'test-user-id',
                guildId: 'test-guild-id',
            }, mockContext);
        });
    });

    describe('Zodiac Sign Processing', () => {
        test('should process valid zodiac sign names', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'cancer';}
                if (param === 'type') {return 'daily';}
                if (param === 'period') {return 'today';}
                return null;
            });

            mockZodiacUtil.getZodiacInfo.mockReturnValue({
                sign: 'Cancer',
                emoji: '♋',
                element: 'Water',
                planet: 'Moon',
                colors: [0x87CEEB],
                traits: ['nurturing', 'intuitive'],
                compatibility: ['Scorpio', 'Pisces'],
                dateRange: 'Jun 21 - Jul 22',
                startDate: { month: 6, day: 21 },
                endDate: { month: 7, day: 22 },
            });

            mockHoroscopeGenerator.generate.mockResolvedValue({
                content: 'Test horoscope content',
                luckyNumbers: '7, 14, 21',
                luckyColor: 'Moonlit Silver 🌙',
                mood: 'Intuitive 🔮',
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockHoroscopeGenerator.generate).toHaveBeenCalledWith({
                sign: 'cancer',
                type: 'daily',
                period: 'today',
                userId: 'test-user-id',
                guildId: 'test-guild-id',
            }, mockContext);
        });
    });

    describe('Horoscope Generation and Display', () => {
        test('should generate and display daily horoscope', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'cancer';}
                if (param === 'type') {return 'daily';}
                if (param === 'period') {return 'today';}
                return null;
            });

            mockZodiacUtil.parseSignInput.mockReturnValue({ sign: 'cancer' });
            mockZodiacUtil.getZodiacInfo.mockReturnValue({
                sign: 'Cancer',
                emoji: '♋',
                element: 'Water',
                planet: 'Moon',
                colors: [0x87CEEB],
                traits: ['nurturing', 'intuitive'],
                compatibility: ['Scorpio', 'Pisces'],
                dateRange: 'Jun 21 - Jul 22',
                startDate: { month: 6, day: 21 },
                endDate: { month: 7, day: 22 },
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];

            expect(embed.data.title).toContain('♋');
            expect(embed.data.title).toContain('Cancer');
            expect(embed.data.title).toContain('Today');
            expect(embed.data.description).toBe('*Test horoscope content for Aries today.*');
            expect(embed.data.color).toBe(0x87CEEB);

            // Check fields - should have at least 3 basic fields
            const fields = embed.data.fields;
            expect(fields.length).toBeGreaterThanOrEqual(3);
            expect(fields.find((f: any) => f.name === '🎨 Lucky Color')).toBeDefined();
            expect(fields.find((f: any) => f.name === '🔢 Lucky Numbers')).toBeDefined();
            expect(fields.find((f: any) => f.name === '💫 Cosmic Mood')).toBeDefined();
        });

        test('should display love horoscope with compatibility', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'libra';}
                if (param === 'type') {return 'love';}
                if (param === 'period') {return 'today';}
                return null;
            });

            mockHoroscopeGenerator.generate.mockResolvedValue({
                content: 'Love is in the air for Libra!',
                luckyNumbers: '2, 6, 14, 22, 30',
                luckyColor: 'Rose Pink 💗',
                mood: 'Romantic 💖',
                compatibility: '♌ Leo',
                advice: 'Open your heart to new possibilities.',
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            const editReplyCall = mockInteraction.editReply.mock.calls[0][0];
            const embed = editReplyCall.embeds[0];
            const fields = embed.data.fields;

            expect(fields.find((f: any) => f.name === '💝 Most Compatible')).toBeDefined();
            expect(fields.find((f: any) => f.name === '⭐ Cosmic Advice')).toBeDefined();
        });

        test('should handle different time periods correctly', async () => {
            const periods = ['today', 'tomorrow', 'this-week', 'next-week', 'this-month'];

            for (const period of periods) {
                jest.clearAllMocks();

                mockInteraction.options.getString.mockImplementation((param: string) => {
                    if (param === 'sign') {return 'scorpio';}
                    if (param === 'type') {return 'daily';}
                    if (param === 'period') {return period;}
                    return null;
                });

                await horoscopeCommand.execute(mockInteraction, mockContext);

                expect(mockHoroscopeGenerator.generate).toHaveBeenCalledWith({
                    sign: 'scorpio',
                    type: 'daily',
                    period: period,
                    userId: 'test-user-id',
                    guildId: 'test-guild-id',
                }, mockContext);
            }
        });
    });

    describe('User Statistics Update', () => {
        test('should update user preferences and statistics', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'virgo';}
                if (param === 'type') {return 'career';}
                if (param === 'period') {return 'today';}
                return null;
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockContext.tables.HoroscopeUser.upsert).toHaveBeenCalledWith({
                userId: 'test-user-id',
                guildId: 'test-guild-id',
                zodiacSign: 'virgo',
                preferredType: 'career',
                lastReadDate: expect.any(Date),
                totalReads: 'MOCK_LITERAL',
            });

            expect(mockContext.tables.Config.upsert).toHaveBeenCalledWith({
                key: 'command_usage_horoscope',
                value: '1',
            });

            expect(mockContext.tables.Config.upsert).toHaveBeenCalledWith({
                key: 'horoscope_type_career',
                value: '1',
            });
        });

        test('should increment existing usage stats', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'gemini';}
                return 'daily';
            });

            (mockContext.tables.Config.findOne as jest.Mock)
                .mockResolvedValueOnce({ value: '42' }) // command_usage_horoscope
                .mockResolvedValueOnce({ value: '15' }); // horoscope_type_daily

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockContext.tables.Config.upsert).toHaveBeenCalledWith({
                key: 'command_usage_horoscope',
                value: '43',
            });

            expect(mockContext.tables.Config.upsert).toHaveBeenCalledWith({
                key: 'horoscope_type_daily',
                value: '16',
            });
        });
    });

    describe('Public vs Private Display', () => {
        test('should default to private display', async () => {
            mockInteraction.options.getString.mockReturnValue('aries');
            mockInteraction.options.getBoolean.mockReturnValue(false);

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        });

        test('should support public display when requested', async () => {
            mockInteraction.options.getString.mockReturnValue('taurus');
            mockInteraction.options.getBoolean.mockReturnValue(true);

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: false });
        });
    });

    describe('Error Handling', () => {
        test('should handle horoscope generation errors', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'sagittarius';}
                if (param === 'type') {return 'daily';}
                if (param === 'period') {return 'today';}
                return null;
            });
            mockHoroscopeGenerator.generate.mockRejectedValue(new Error('API Error'));

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith('Horoscope command failed', {
                userId: 'test-user-id',
                error: expect.any(Error),
            });

            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: '🔮 The cosmic energies are disrupted. Please try again in a moment.',
            });
        });

        test('should handle database errors gracefully', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return null;} // No sign provided, force database lookup
                if (param === 'type') {return 'daily';}
                if (param === 'period') {return 'today';}
                return null;
            });
            (mockContext.tables.HoroscopeUser.findOne as jest.Mock).mockRejectedValue(new Error('Database Error'));

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalledWith('Horoscope command failed', expect.any(Object));
        });

        test('should handle interaction errors before defer', async () => {
            const interactionError = new Error('Interaction failed');
            mockInteraction.deferReply.mockRejectedValue(interactionError);
            mockInteraction.deferred = false;

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '🔮 The cosmic energies are disrupted. Please try again in a moment.',
                ephemeral: true,
            });
        });

        test('should not break on stats update failures', async () => {
            mockInteraction.options.getString.mockReturnValue('pisces');
            (mockContext.tables.Config.upsert as jest.Mock).mockRejectedValue(new Error('Stats Error'));

            await horoscopeCommand.execute(mockInteraction, mockContext);

            // Should still complete successfully
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                embeds: [expect.any(Object)],
            });
        });
    });

    describe('Logging', () => {
        test('should log successful command execution', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'aquarius';}
                if (param === 'type') {return 'weekly';}
                if (param === 'period') {return 'this-week';}
                return null;
            });
            mockInteraction.options.getBoolean.mockReturnValue(true);

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith('Horoscope command executed', {
                userId: 'test-user-id',
                username: 'testuser',
                guildId: 'test-guild-id',
                sign: 'aquarius',
                type: 'weekly',
                period: 'this-week',
                isPublic: true,
            });
        });
    });

    describe('Default Values', () => {
        test('should use default type and period when not specified', async () => {
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'leo';}
                // type and period return null (defaults)
                return null;
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            expect(mockHoroscopeGenerator.generate).toHaveBeenCalledWith({
                sign: 'leo',
                type: 'daily',
                period: 'today',
                userId: 'test-user-id',
                guildId: 'test-guild-id',
            }, mockContext);
        });
    });

    describe('Guild Context', () => {
        test('should handle missing guild context', async () => {
            mockInteraction.guild = null;
            mockInteraction.options.getString.mockImplementation((param: string) => {
                if (param === 'sign') {return 'aries';}
                if (param === 'type') {return 'daily';}
                if (param === 'period') {return 'today';}
                return null;
            });

            mockHoroscopeGenerator.generate.mockResolvedValue({
                content: 'Test horoscope content for Aries today.',
                luckyNumbers: '7, 14, 21, 28, 35',
                luckyColor: 'Stellar Gold ⭐',
                mood: 'Radiant ✨',
            });

            await horoscopeCommand.execute(mockInteraction, mockContext);

            // Should update user stats with null guild
            expect(mockContext.tables.HoroscopeUser.upsert).toHaveBeenCalledWith({
                userId: 'test-user-id',
                guildId: null,
                zodiacSign: 'aries',
                preferredType: 'daily',
                lastReadDate: expect.any(Date),
                totalReads: 'MOCK_LITERAL',
            });

            expect(mockHoroscopeGenerator.generate).toHaveBeenCalledWith({
                sign: 'aries',
                type: 'daily',
                period: 'today',
                userId: 'test-user-id',
                guildId: undefined,
            }, mockContext);
        });
    });
});