import { Tool, ToolAnswer, ToolContext } from './types';

/**
 * Cities people actually ask about. A full tz database lookup is not worth the
 * dependency, and an unknown place returns null rather than a confident answer
 * about the wrong clock.
 */
const ZONES: Record<string, string> = {
    'tokyo': 'Asia/Tokyo',
    'japan': 'Asia/Tokyo',
    'new york': 'America/New_York',
    'nyc': 'America/New_York',
    'los angeles': 'America/Los_Angeles',
    'la': 'America/Los_Angeles',
    'chicago': 'America/Chicago',
    'denver': 'America/Denver',
    'london': 'Europe/London',
    'uk': 'Europe/London',
    'paris': 'Europe/Paris',
    'berlin': 'Europe/Berlin',
    'moscow': 'Europe/Moscow',
    'dubai': 'Asia/Dubai',
    'india': 'Asia/Kolkata',
    'sydney': 'Australia/Sydney',
    'utc': 'UTC',
};

export function resolveTimeZone(query: string): string | null {
    const match = /\bin\s+([a-z\s]{2,30})/i.exec(query.toLowerCase());
    if (!match) {
        return 'UTC';
    }
    const place = match[1].replace(/[?!.]+$/, '').trim();
    return ZONES[place] ?? null;
}

export const timeDateTool: Tool = {
    name: 'time_date',

    async run(query: string, _ctx: ToolContext): Promise<ToolAnswer | null> {
        void _ctx;
        const zone = resolveTimeZone(query);
        if (!zone) {
            return null;
        }

        try {
            const now = new Date();
            const time = new Intl.DateTimeFormat('en-GB', {
                timeZone: zone, hour: '2-digit', minute: '2-digit',
            }).format(now);
            const date = new Intl.DateTimeFormat('en-GB', {
                timeZone: zone, weekday: 'long', day: 'numeric', month: 'long',
            }).format(now);

            return {
                title: zone.split('/').pop()!.replace(/_/g, ' '),
                body: `${time} — ${date}`,
                sourceLabel: 'server clock',
            };
        } catch {
            return null;
        }
    },
};
