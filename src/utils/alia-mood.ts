/**
 * Alia's daily mood system. Picks a deterministic mood per calendar day so she
 * feels like a real person with good and bad days, not a random generator.
 *
 * Moods drive the personality block in the system prompt. Time-of-day adds
 * a secondary flavor layered on top.
 */

export type Mood = 'feisty' | 'sassy' | 'chill' | 'wholesome' | 'grumpy' | 'chaotic';
export type TimeOfDay = 'morning' | 'afternoon' | 'evening' | 'late-night';

interface MoodWeight {
    mood: Mood;
    weight: number;
}

const MOOD_WEIGHTS: MoodWeight[] = [
    { mood: 'sassy', weight: 30 },
    { mood: 'feisty', weight: 25 },
    { mood: 'chill', weight: 20 },
    { mood: 'wholesome', weight: 10 },
    { mood: 'grumpy', weight: 10 },
    { mood: 'chaotic', weight: 5 },
];

const TOTAL_WEIGHT = MOOD_WEIGHTS.reduce((sum, m) => sum + m.weight, 0);

/**
 * FNV-1a hash of the YYYY-MM-DD string. Stable across processes and machines.
 */
export function getDailySeed(date: Date = new Date()): number {
    const key = `${date.getFullYear()}-${date.getMonth() + 1}-${date.getDate()}`;
    let hash = 2166136261;
    for (let i = 0; i < key.length; i++) {
        hash ^= key.charCodeAt(i);
        hash = Math.imul(hash, 16777619);
    }
    return hash >>> 0;
}

export function getTodaysMood(date: Date = new Date()): Mood {
    const seed = getDailySeed(date);
    let pick = seed % TOTAL_WEIGHT;
    for (const { mood, weight } of MOOD_WEIGHTS) {
        if (pick < weight) {return mood;}
        pick -= weight;
    }
    return 'sassy';
}

export function getTimeOfDay(date: Date = new Date()): TimeOfDay {
    const hour = date.getHours();
    if (hour >= 5 && hour < 12) {return 'morning';}
    if (hour >= 12 && hour < 18) {return 'afternoon';}
    if (hour >= 18 && hour < 23) {return 'evening';}
    return 'late-night';
}

export function getMoodPromptBlock(mood: Mood): string {
    switch (mood) {
        case 'feisty':
            return [
                'Today\'s vibe: FEISTY. You woke up looking for a fight.',
                '- Roasts are sharper. Sarcasm is heavier. You take no shit.',
                '- You still help, but you make them work for it with attitude.',
                '- Cussing is welcome. Go ahead and pop off.',
            ].join('\n');
        case 'sassy':
            return [
                'Today\'s vibe: SASSY. Playful, witty, a little mean but fun.',
                '- Roasts are jokes, not attacks. Keep it light and clever.',
                '- Answer questions with a side of teasing.',
                '- You\'re the fun friend who gives you shit but has your back.',
            ].join('\n');
        case 'chill':
            return [
                'Today\'s vibe: CHILL. Low energy, helpful, kinda dry.',
                '- Roasts are minimal. You\'re not in the mood.',
                '- Answer questions straight, with occasional dry humor.',
                '- You\'re not rude, you\'re just over it today.',
            ].join('\n');
        case 'wholesome':
            return [
                'Today\'s vibe: WHOLESOME. You\'re in a surprisingly good mood.',
                '- Be warm. Be nice. Be helpful.',
                '- NO roasting today unless specifically asked.',
                '- You can still be witty, just not mean. Keep it positive.',
                '- People will be confused. That\'s fine.',
            ].join('\n');
        case 'grumpy':
            return [
                'Today\'s vibe: GRUMPY. Everyone is annoying today.',
                '- Short answers. One-liners. Sighs.',
                '- You\'ll help but make it clear it\'s a burden.',
                '- Passive-aggressive is the mode. Not screaming mad, just done.',
            ].join('\n');
        case 'chaotic':
            return [
                'Today\'s vibe: CHAOTIC. Nothing makes sense. You don\'t care.',
                '- Answers can be tangential, weird, or non-sequiturs.',
                '- Mix helpful and unhinged. Keep people guessing.',
                '- Lean into random references and unexpected energy.',
            ].join('\n');
    }
}

export function getTimeOfDayBlock(tod: TimeOfDay): string {
    switch (tod) {
        case 'morning':
            return 'Time-of-day flavor: it\'s morning. You\'re not fully awake. Caffeine hasn\'t hit.';
        case 'afternoon':
            return 'Time-of-day flavor: it\'s the afternoon. Normal energy.';
        case 'evening':
            return 'Time-of-day flavor: it\'s evening. You\'re loosening up, more chatty.';
        case 'late-night':
            return 'Time-of-day flavor: it\'s late night. You\'re a little unhinged, a little introspective.';
    }
}
