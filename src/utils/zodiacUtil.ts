interface ZodiacInfo {
    sign: string;
    emoji: string;
    element: string;
    planet: string;
    colors: number[];
    traits: string[];
    compatibility: string[];
    dateRange: string;
    startDate: { month: number; day: number };
    endDate: { month: number; day: number };
}

export class ZodiacUtil {
    private static readonly ZODIAC_DATA: { [key: string]: ZodiacInfo } = {
        aries: {
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
        },
        taurus: {
            sign: 'Taurus',
            emoji: '♉',
            element: 'Earth',
            planet: 'Venus',
            colors: [0x228B22, 0x32CD32],
            traits: ['reliable', 'practical', 'devoted', 'stable'],
            compatibility: ['Virgo', 'Capricorn', 'Cancer', 'Pisces'],
            dateRange: 'Apr 20 - May 20',
            startDate: { month: 4, day: 20 },
            endDate: { month: 5, day: 20 },
        },
        gemini: {
            sign: 'Gemini',
            emoji: '♊',
            element: 'Air',
            planet: 'Mercury',
            colors: [0xFFD700, 0xFFA500],
            traits: ['adaptable', 'curious', 'communicative', 'witty'],
            compatibility: ['Libra', 'Aquarius', 'Aries', 'Leo'],
            dateRange: 'May 21 - Jun 20',
            startDate: { month: 5, day: 21 },
            endDate: { month: 6, day: 20 },
        },
        cancer: {
            sign: 'Cancer',
            emoji: '♋',
            element: 'Water',
            planet: 'Moon',
            colors: [0x87CEEB, 0x4682B4],
            traits: ['nurturing', 'intuitive', 'emotional', 'protective'],
            compatibility: ['Scorpio', 'Pisces', 'Taurus', 'Virgo'],
            dateRange: 'Jun 21 - Jul 22',
            startDate: { month: 6, day: 21 },
            endDate: { month: 7, day: 22 },
        },
        leo: {
            sign: 'Leo',
            emoji: '♌',
            element: 'Fire',
            planet: 'Sun',
            colors: [0xFFD700, 0xFF8C00],
            traits: ['confident', 'generous', 'creative', 'leadership'],
            compatibility: ['Aries', 'Sagittarius', 'Gemini', 'Libra'],
            dateRange: 'Jul 23 - Aug 22',
            startDate: { month: 7, day: 23 },
            endDate: { month: 8, day: 22 },
        },
        virgo: {
            sign: 'Virgo',
            emoji: '♍',
            element: 'Earth',
            planet: 'Mercury',
            colors: [0x9ACD32, 0x6B8E23],
            traits: ['analytical', 'practical', 'perfectionist', 'helpful'],
            compatibility: ['Taurus', 'Capricorn', 'Cancer', 'Scorpio'],
            dateRange: 'Aug 23 - Sep 22',
            startDate: { month: 8, day: 23 },
            endDate: { month: 9, day: 22 },
        },
        libra: {
            sign: 'Libra',
            emoji: '♎',
            element: 'Air',
            planet: 'Venus',
            colors: [0xFFB6C1, 0xFF69B4],
            traits: ['diplomatic', 'balanced', 'social', 'harmonious'],
            compatibility: ['Gemini', 'Aquarius', 'Leo', 'Sagittarius'],
            dateRange: 'Sep 23 - Oct 22',
            startDate: { month: 9, day: 23 },
            endDate: { month: 10, day: 22 },
        },
        scorpio: {
            sign: 'Scorpio',
            emoji: '♏',
            element: 'Water',
            planet: 'Pluto',
            colors: [0x8B0000, 0x4B0082],
            traits: ['intense', 'passionate', 'mysterious', 'transformative'],
            compatibility: ['Cancer', 'Pisces', 'Virgo', 'Capricorn'],
            dateRange: 'Oct 23 - Nov 21',
            startDate: { month: 10, day: 23 },
            endDate: { month: 11, day: 21 },
        },
        sagittarius: {
            sign: 'Sagittarius',
            emoji: '♐',
            element: 'Fire',
            planet: 'Jupiter',
            colors: [0x800080, 0x9932CC],
            traits: ['adventurous', 'philosophical', 'optimistic', 'independent'],
            compatibility: ['Aries', 'Leo', 'Libra', 'Aquarius'],
            dateRange: 'Nov 22 - Dec 21',
            startDate: { month: 11, day: 22 },
            endDate: { month: 12, day: 21 },
        },
        capricorn: {
            sign: 'Capricorn',
            emoji: '♑',
            element: 'Earth',
            planet: 'Saturn',
            colors: [0x2F4F4F, 0x696969],
            traits: ['ambitious', 'disciplined', 'responsible', 'practical'],
            compatibility: ['Taurus', 'Virgo', 'Scorpio', 'Pisces'],
            dateRange: 'Dec 22 - Jan 19',
            startDate: { month: 12, day: 22 },
            endDate: { month: 1, day: 19 },
        },
        aquarius: {
            sign: 'Aquarius',
            emoji: '♒',
            element: 'Air',
            planet: 'Uranus',
            colors: [0x00FFFF, 0x1E90FF],
            traits: ['innovative', 'independent', 'humanitarian', 'eccentric'],
            compatibility: ['Gemini', 'Libra', 'Aries', 'Sagittarius'],
            dateRange: 'Jan 20 - Feb 18',
            startDate: { month: 1, day: 20 },
            endDate: { month: 2, day: 18 },
        },
        pisces: {
            sign: 'Pisces',
            emoji: '♓',
            element: 'Water',
            planet: 'Neptune',
            colors: [0x9966FF, 0x6A5ACD],
            traits: ['intuitive', 'compassionate', 'artistic', 'dreamy'],
            compatibility: ['Cancer', 'Scorpio', 'Taurus', 'Capricorn'],
            dateRange: 'Feb 19 - Mar 20',
            startDate: { month: 2, day: 19 },
            endDate: { month: 3, day: 20 },
        },
    };

    static getZodiacInfo(sign: string): ZodiacInfo {
        const normalizedSign = sign.toLowerCase();
        return this.ZODIAC_DATA[normalizedSign] || this.ZODIAC_DATA['aries'];
    }

    static getAllSigns(): string[] {
        return Object.keys(this.ZODIAC_DATA);
    }

    static parseSignInput(input: string): { sign: string; birthDate?: string } {
        const trimmed = input.trim();

        // Check if input is a date (MM-DD format)
        const dateMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})$/);
        if (dateMatch) {
            const month = parseInt(dateMatch[1], 10);
            const day = parseInt(dateMatch[2], 10);

            if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                const sign = this.getSignByDate(month, day);
                return {
                    sign: sign.toLowerCase(),
                    birthDate: `${month.toString().padStart(2, '0')}-${day.toString().padStart(2, '0')}`,
                };
            }
        }

        // Check if input is a zodiac sign name
        const normalizedInput = trimmed.toLowerCase();
        for (const [sign, data] of Object.entries(this.ZODIAC_DATA)) {
            if (sign === normalizedInput ||
                data.sign.toLowerCase() === normalizedInput ||
                data.sign.toLowerCase().startsWith(normalizedInput)) {
                return { sign };
            }
        }

        // Default to Aries if no match found
        return { sign: 'aries' };
    }

    static getSignByDate(month: number, day: number): string {
        for (const [, data] of Object.entries(this.ZODIAC_DATA)) {
            if (this.isDateInRange(month, day, data.startDate, data.endDate)) {
                return data.sign;
            }
        }
        return 'Aries'; // Fallback
    }

    private static isDateInRange(
        month: number,
        day: number,
        start: { month: number; day: number },
        end: { month: number; day: number },
    ): boolean {
        // Handle year-crossing signs (Capricorn)
        if (start.month > end.month) {
            return (
                (month === start.month && day >= start.day) ||
                (month > start.month) ||
                (month < end.month) ||
                (month === end.month && day <= end.day)
            );
        }

        return (
            (month > start.month || (month === start.month && day >= start.day)) &&
            (month < end.month || (month === end.month && day <= end.day))
        );
    }

    static async getSignSuggestions(input: string): Promise<any[]> {
        const suggestions: any[] = [];

        // Check if input looks like a date
        if (/^\d{1,2}[/-]?\d{0,2}$/.test(input)) {
            const dateParts = input.replace(/[/-]/, '-').split('-');
            if (dateParts.length === 1) {
                // Just month, suggest format
                suggestions.push({
                    name: `${input}-DD (Enter your birth date)`,
                    value: input,
                });
            } else if (dateParts.length === 2) {
                const month = parseInt(dateParts[0], 10);
                const day = parseInt(dateParts[1], 10);
                if (month >= 1 && month <= 12 && day >= 1 && day <= 31) {
                    const sign = this.getSignByDate(month, day);
                    const zodiacInfo = this.getZodiacInfo(sign);
                    suggestions.push({
                        name: `${input} → ${zodiacInfo.emoji} ${sign} (${zodiacInfo.dateRange})`,
                        value: input,
                    });
                }
            }
        }

        // Add zodiac sign suggestions
        const normalizedInput = input.toLowerCase();
        for (const [sign, data] of Object.entries(this.ZODIAC_DATA)) {
            if (
                sign.includes(normalizedInput) ||
                data.sign.toLowerCase().includes(normalizedInput)
            ) {
                suggestions.push({
                    name: `${data.emoji} ${data.sign} (${data.dateRange})`,
                    value: sign,
                });
            }
        }

        // Sort by relevance (exact matches first, then partial matches)
        suggestions.sort((a, b) => {
            const aExact = a.value.toLowerCase() === normalizedInput;
            const bExact = b.value.toLowerCase() === normalizedInput;
            if (aExact && !bExact) {return -1;}
            if (!aExact && bExact) {return 1;}

            const aStarts = a.value.toLowerCase().startsWith(normalizedInput);
            const bStarts = b.value.toLowerCase().startsWith(normalizedInput);
            if (aStarts && !bStarts) {return -1;}
            if (!aStarts && bStarts) {return 1;}

            return a.name.localeCompare(b.name);
        });

        return suggestions.slice(0, 25);
    }

    static getRandomCompatibleSign(sign: string): string {
        const zodiacInfo = this.getZodiacInfo(sign);
        const compatibleSigns = zodiacInfo.compatibility;
        return compatibleSigns[Math.floor(Math.random() * compatibleSigns.length)];
    }

    static getElementSigns(element: string): string[] {
        return Object.values(this.ZODIAC_DATA)
            .filter(data => data.element.toLowerCase() === element.toLowerCase())
            .map(data => data.sign);
    }

    static getSignsByCompatibility(sign: string): { most: string[]; least: string[] } {
        const zodiacInfo = this.getZodiacInfo(sign);
        const allSigns = Object.values(this.ZODIAC_DATA).map(data => data.sign);

        const most = zodiacInfo.compatibility;
        const least = allSigns.filter(s =>
            s !== zodiacInfo.sign && !most.includes(s),
        ).slice(0, 4);

        return { most, least };
    }
}