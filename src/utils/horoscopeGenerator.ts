import { ZodiacUtil } from './zodiacUtil';
import { Context } from './types';

interface HoroscopeRequest {
    sign: string;
    type: string;
    period: string;
    userId: string;
    guildId?: string;
}

interface HoroscopeData {
    content: string;
    luckyNumbers: string;
    luckyColor: string;
    mood: string;
    compatibility?: string;
    advice?: string;
}

interface HoroscopeTemplate {
    category: string;
    template: string;
    weight: number;
}

export class HoroscopeGenerator {
    private static readonly CONTENT_TEMPLATES = {
        daily: [
            {
                category: 'positive',
                template: "The cosmic energies align beautifully for {sign} today! Your {element} nature will be " +
                    "your greatest strength as {planet} bestows its favor upon you. Expect opportunities in areas " +
                    "requiring your natural {trait1} and {trait2} abilities. The universe conspires to bring " +
                    "you closer to your goals.",
                weight: 3,
            },
            {
                category: 'motivational',
                template: "Today challenges {sign} to embrace their inner {trait1} spirit. As a {element} sign " +
                    "ruled by {planet}, you possess the unique ability to {action}. Trust your instincts, " +
                    "dear {sign}, for they will guide you toward unexpected victories.",
                weight: 3,
            },
            {
                category: 'neutral',
                template: "A day of balance awaits {sign}. Your {element} energy flows steadily, encouraging " +
                    "practical decisions and meaningful connections. {planet}'s influence reminds you to " +
                    "stay grounded while remaining open to new possibilities.",
                weight: 2,
            },
            {
                category: 'reflective',
                template: "The stars invite {sign} to pause and reflect today. Your {trait1} nature has carried " +
                    "you far, and now it's time to appreciate the journey. {planet} whispers wisdom about the " +
                    "importance of both action and rest.",
                weight: 1,
            },
        ],
        love: [
            {
                category: 'romantic',
                template: "Venus dances through your heart sector, dear {sign}! Your magnetic {trait1} energy draws " +
                    "romantic possibilities like a cosmic magnet. If partnered, expect deeper intimacy. If single, " +
                    "your {trait2} charm will captivate someone special. Love flows through your " +
                    "{element} essence today.",
                weight: 4,
            },
            {
                category: 'relationship',
                template: "Relationships take center stage for {sign} today. Your natural {trait1} approach to " +
                    "love creates harmony and understanding. {planet}'s energy encourages honest communication and " +
                    "emotional vulnerability. Let your heart lead with {trait2} confidence.",
                weight: 3,
            },
            {
                category: 'self-love',
                template: "The greatest love story for {sign} today begins with self-appreciation. Your {element} " +
                    "spirit deserves recognition for its strength and beauty. Practice self-care rituals that honor " +
                    "your {trait1} nature and nurture your inner flame.",
                weight: 2,
            },
        ],
        career: [
            {
                category: 'opportunity',
                template: "Professional opportunities shimmer on the horizon for {sign}! Your reputation for being " +
                    "{trait1} and {trait2} opens doors previously unseen. {planet}'s energy amplifies your natural " +
                    "leadership abilities. Bold decisions made today will pay dividends in the future.",
                weight: 4,
            },
            {
                category: 'collaboration',
                template: "Teamwork and collaboration are your superpowers today, {sign}. Your {element} energy " +
                    "harmonizes beautifully with colleagues, creating innovative solutions. Use your {trait1} skills " +
                    "to bridge gaps and build lasting professional relationships.",
                weight: 3,
            },
            {
                category: 'skills',
                template: "Time to showcase your unique talents, {sign}! Your {trait1} abilities combined with " +
                    "your natural {trait2} approach sets you apart from the crowd. {planet} encourages you to step " +
                    "into the spotlight and claim your professional worth.",
                weight: 3,
            },
        ],
        lucky: [
            {
                category: 'numbers',
                template: "The cosmic lottery smiles upon {sign} today! Lucky numbers flow from {planet}'s " +
                    "numerical vibrations, while fortune favors your {trait1} endeavors. Wear or surround yourself " +
                    "with your power colors to amplify this magnificent energy.",
                weight: 3,
            },
            {
                category: 'timing',
                template: "Perfect timing is {sign}'s secret weapon today! Your {element} intuition will guide " +
                    "you to seize the right moments for maximum impact. Watch for signs and synchronicities - " +
                    "the universe is speaking directly to you.",
                weight: 3,
            },
        ],
        weekly: [
            {
                category: 'overview',
                template: "This week unfolds like a beautiful tapestry for {sign}, woven with threads of opportunity " +
                    "and growth. Your {trait1} nature will be tested and strengthened, while {planet}'s " +
                    "weekly transit brings unexpected gifts. Embrace change with your characteristic {trait2} spirit.",
                weight: 3,
            },
            {
                category: 'challenges',
                template: "The week ahead presents {sign} with meaningful challenges that will ultimately strengthen " +
                    "your resolve. Your {element} essence provides the stability needed to navigate " +
                    "uncertain waters. Remember, every obstacle is a stepping stone to greater wisdom.",
                weight: 2,
            },
        ],
        monthly: [
            {
                category: 'transformation',
                template: "This month marks a significant chapter in {sign}'s cosmic journey. {planet}'s monthly " +
                    "influence brings transformation opportunities that align with your soul's purpose. " +
                    "Your {trait1} and {trait2} qualities will be your guiding stars through this evolutionary period.",
                weight: 3,
            },
            {
                category: 'goals',
                template: "The month ahead is perfectly designed for {sign} to manifest their deepest desires. " +
                    "Your {element} energy builds momentum with each passing day, supported by {planet}'s unwavering " +
                    "guidance. Set intentions that honor both your practical needs and spiritual growth.",
                weight: 3,
            },
        ],
    };

    private static readonly MOOD_TEMPLATES = {
        positive: ['Radiant ✨', 'Magnetic 🌟', 'Powerful ⚡', 'Harmonious 🌈', 'Confident 💫'],
        motivational: ['Determined 🎯', 'Focused 🔥', 'Ambitious 💪', 'Inspired 🚀', 'Courageous 🦁'],
        peaceful: ['Serene 🌙', 'Balanced ⚖️', 'Centered 🧘', 'Calm 🌊', 'Grounded 🌳'],
        creative: ['Innovative 🎨', 'Artistic 🎭', 'Visionary 👁️', 'Imaginative 🌌', 'Expressive 🎵'],
    };

    private static readonly LUCKY_COLORS = [
        'Cosmic Purple 💜', 'Stellar Gold ⭐', 'Mystic Blue 💙', 'Emerald Green 💚',
        'Ruby Red ❤️', 'Sunset Orange 🧡', 'Rose Pink 💗', 'Silver Moon 🤍',
        'Deep Indigo 💙', 'Celestial Turquoise 💎', 'Phoenix Crimson 🔥', 'Forest Sage 🌿',
    ];

    private static readonly ADVICE_TEMPLATES = {
        daily: [
            "Trust your instincts today - they're more accurate than usual.",
            "A small act of kindness will return to you tenfold.",
            "Pay attention to synchronicities and meaningful coincidences.",
            "Your unique perspective is exactly what someone needs to hear.",
            "Take a moment to appreciate how far you've come.",
        ],
        love: [
            "Vulnerability is your superpower in relationships today.",
            "Listen with your heart, not just your ears.",
            "Express gratitude for the love already present in your life.",
            "Your authentic self is your most attractive quality.",
            "Love starts with loving yourself unconditionally.",
        ],
        career: [
            "Your reputation speaks for itself - let your work do the talking.",
            "Collaboration will unlock doors that seemed permanently closed.",
            "Invest in relationships, not just transactions.",
            "Your unique skills are needed in ways you haven't imagined yet.",
            "Success is not a destination but a journey of continuous growth.",
        ],
    };

    static async generate(request: HoroscopeRequest, context: Context): Promise<HoroscopeData> {
        const { sign, type, period } = request;

        // Check cache first
        const cached = await this.getCachedReading(sign, type, period, context);
        if (cached) {
            return cached;
        }

        // Generate new reading
        const zodiacInfo = ZodiacUtil.getZodiacInfo(sign);
        const templates = this.CONTENT_TEMPLATES[type as keyof typeof this.CONTENT_TEMPLATES] ||
            this.CONTENT_TEMPLATES.daily;

        // Select template based on weights and user history
        const selectedTemplate = await this.selectTemplate(templates);

        // Generate content
        const content = this.fillTemplate(selectedTemplate.template, zodiacInfo);
        const luckyNumbers = this.generateLuckyNumbers();
        const luckyColor = this.selectLuckyColor(zodiacInfo);
        const mood = this.selectMood(selectedTemplate.category);

        let compatibility: string | undefined;
        let advice: string | undefined;

        // Add type-specific enhancements
        if (type === 'love') {
            const compatibleSign = ZodiacUtil.getRandomCompatibleSign(sign);
            const compatibleInfo = ZodiacUtil.getZodiacInfo(compatibleSign);
            compatibility = `${compatibleInfo.emoji} ${compatibleSign}`;
        }

        if (['daily', 'love', 'career'].includes(type)) {
            advice = this.selectAdvice(type);
        }

        const result: HoroscopeData = {
            content,
            luckyNumbers,
            luckyColor,
            mood,
            compatibility,
            advice,
        };

        // Cache the result
        await this.cacheReading(sign, type, period, result, context);

        return result;
    }

    private static async getCachedReading(
        sign: string,
        type: string,
        period: string,
        context: Context,
    ): Promise<HoroscopeData | null> {
        try {
            const cacheKey = `${sign}_${type}_${period}_${this.getDateKey(period)}`;
            const cached = await context.tables.HoroscopeCache?.findOne({
                where: {
                    cacheKey,
                    expiresAt: { [(context.sequelize as any).Op.gt]: new Date() },
                },
            });

            if (cached) {
                return {
                    content: cached.content,
                    luckyNumbers: cached.luckyNumbers,
                    luckyColor: cached.luckyColor,
                    mood: cached.mood,
                    compatibility: cached.compatibility || undefined,
                };
            }
        } catch (error) {
            context.log.error('Error reading horoscope cache', { error });
        }

        return null;
    }

    private static async cacheReading(
        sign: string,
        type: string,
        period: string,
        data: HoroscopeData,
        context: Context,
    ): Promise<void> {
        try {
            const cacheKey = `${sign}_${type}_${period}_${this.getDateKey(period)}`;
            const expiresAt = this.calculateExpiration(period);

            await context.tables.HoroscopeCache?.upsert({
                cacheKey,
                sign,
                type,
                period,
                content: data.content,
                luckyNumbers: data.luckyNumbers,
                luckyColor: data.luckyColor,
                compatibility: data.compatibility || '',
                mood: data.mood,
                expiresAt,
            });
        } catch (error) {
            context.log.error('Error caching horoscope reading', { error });
        }
    }

    private static async selectTemplate(
        templates: HoroscopeTemplate[],
    ): Promise<HoroscopeTemplate> {
        // Create weighted selection based on template weights
        const weightedTemplates: HoroscopeTemplate[] = [];
        templates.forEach(template => {
            for (let i = 0; i < template.weight; i++) {
                weightedTemplates.push(template);
            }
        });

        // TODO: In the future, consider user history to avoid repetition
        // For now, random weighted selection
        const randomIndex = Math.floor(Math.random() * weightedTemplates.length);
        return weightedTemplates[randomIndex];
    }

    private static fillTemplate(template: string, zodiacInfo: any): string {
        const traits = zodiacInfo.traits;
        const trait1 = traits[Math.floor(Math.random() * traits.length)];
        let trait2 = traits[Math.floor(Math.random() * traits.length)];

        // Ensure trait2 is different from trait1
        while (trait2 === trait1 && traits.length > 1) {
            trait2 = traits[Math.floor(Math.random() * traits.length)];
        }

        const actions = this.getElementActions(zodiacInfo.element);
        const action = actions[Math.floor(Math.random() * actions.length)];

        return template
            .replace(/{sign}/g, zodiacInfo.sign)
            .replace(/{element}/g, zodiacInfo.element.toLowerCase())
            .replace(/{planet}/g, zodiacInfo.planet)
            .replace(/{trait1}/g, trait1)
            .replace(/{trait2}/g, trait2)
            .replace(/{action}/g, action);
    }

    private static getElementActions(element: string): string[] {
        const actions = {
            Fire: [
                'ignite passion in others', 'lead with confidence', 'inspire bold action', 'create positive change',
            ],
            Earth: [
                'build lasting foundations', 'provide practical solutions', 'nurture steady growth',
                'create tangible results',
            ],
            Air: [
                'communicate with clarity', 'connect diverse perspectives', 'generate innovative ideas',
                'inspire intellectual growth',
            ],
            Water: [
                'navigate emotional depths', 'provide healing presence', 'trust intuitive wisdom',
                'create emotional harmony',
            ],
        };
        return actions[element as keyof typeof actions] || actions.Fire;
    }

    private static generateLuckyNumbers(): string {
        const numbers = new Set<number>();
        while (numbers.size < 5) {
            numbers.add(Math.floor(Math.random() * 99) + 1);
        }
        return Array.from(numbers).sort((a, b) => a - b).join(', ');
    }

    private static selectLuckyColor(zodiacInfo: any): string {
        // Mix zodiac colors with general lucky colors
        const zodiacColors = [`${zodiacInfo.sign} ${zodiacInfo.element} 💫`];
        const allColors = [...zodiacColors, ...this.LUCKY_COLORS];
        return allColors[Math.floor(Math.random() * allColors.length)];
    }

    private static selectMood(category: string): string {
        let moodCategory = 'positive';

        if (category === 'motivational' || category === 'opportunity' || category === 'challenges') {
            moodCategory = 'motivational';
        } else if (category === 'neutral' || category === 'reflective') {
            moodCategory = 'peaceful';
        } else if (category === 'romantic' || category === 'skills') {
            moodCategory = 'creative';
        }

        const moods = this.MOOD_TEMPLATES[moodCategory as keyof typeof this.MOOD_TEMPLATES];
        return moods[Math.floor(Math.random() * moods.length)];
    }

    private static selectAdvice(type: string): string {
        const adviceList = this.ADVICE_TEMPLATES[type as keyof typeof this.ADVICE_TEMPLATES] ||
            this.ADVICE_TEMPLATES.daily;
        return adviceList[Math.floor(Math.random() * adviceList.length)];
    }

    private static getDateKey(period: string): string {
        const now = new Date();

        switch (period) {
            case 'today': {
                return now.toISOString().split('T')[0];
            }
            case 'tomorrow': {
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                return tomorrow.toISOString().split('T')[0];
            }
            case 'this-week': {
                const weekStart = new Date(now);
                weekStart.setDate(now.getDate() - now.getDay());
                return `week_${weekStart.toISOString().split('T')[0]}`;
            }
            case 'next-week': {
                const nextWeekStart = new Date(now);
                nextWeekStart.setDate(now.getDate() - now.getDay() + 7);
                return `week_${nextWeekStart.toISOString().split('T')[0]}`;
            }
            case 'this-month': {
                return `month_${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}`;
            }
            default: {
                return now.toISOString().split('T')[0];
            }
        }
    }

    private static calculateExpiration(period: string): Date {
        const now = new Date();

        switch (period) {
            case 'today': {
                // Expires at midnight
                const tomorrow = new Date(now);
                tomorrow.setDate(tomorrow.getDate() + 1);
                tomorrow.setHours(0, 0, 0, 0);
                return tomorrow;
            }
            case 'tomorrow': {
                // Expires at end of tomorrow
                const dayAfterTomorrow = new Date(now);
                dayAfterTomorrow.setDate(dayAfterTomorrow.getDate() + 2);
                dayAfterTomorrow.setHours(0, 0, 0, 0);
                return dayAfterTomorrow;
            }
            case 'this-week':
            case 'next-week': {
                // Expires at end of week
                const weekEnd = new Date(now);
                weekEnd.setDate(now.getDate() + (7 - now.getDay()));
                weekEnd.setHours(23, 59, 59, 999);
                return weekEnd;
            }
            case 'this-month': {
                // Expires at end of month
                const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
                monthEnd.setHours(23, 59, 59, 999);
                return monthEnd;
            }
            default: {
                // Default: 24 hours
                const defaultExpiry = new Date(now);
                defaultExpiry.setHours(defaultExpiry.getHours() + 24);
                return defaultExpiry;
            }
        }
    }
}