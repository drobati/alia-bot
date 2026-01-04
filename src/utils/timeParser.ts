import * as chrono from 'chrono-node';

export interface ParsedTime {
    date: Date;
    isRecurring: boolean;
    cronSchedule?: string;
    displayText: string;
}

/**
 * Parse natural language time input into a Date object
 * Supports inputs like:
 * - "in 2 hours"
 * - "tomorrow at 3pm"
 * - "next friday at noon"
 * - "december 25 at 9am"
 * - "every day at 9am" (recurring)
 * - "every monday at 10am" (recurring)
 */
export function parseTimeInput(input: string, referenceDate?: Date): ParsedTime | null {
    const ref = referenceDate || new Date();

    // First check for recurring patterns
    const recurringResult = parseRecurringPattern(input);
    if (recurringResult) {
        return recurringResult;
    }

    // Try chrono-node for one-time natural language parsing
    const chronoResult = chrono.parseDate(input, ref, { forwardDate: true });

    if (chronoResult) {
        return {
            date: chronoResult,
            isRecurring: false,
            displayText: formatRelativeTime(chronoResult, ref),
        };
    }

    return null;
}

/**
 * Parse recurring time patterns into cron schedules
 */
function parseRecurringPattern(input: string): ParsedTime | null {
    const lowerInput = input.toLowerCase().trim();

    // "every day at HH:MM" or "every day at H am/pm"
    const dailyMatch = lowerInput.match(/^every\s+day\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i);
    if (dailyMatch) {
        const { hour, minute } = parseTimeComponents(dailyMatch[1], dailyMatch[2], dailyMatch[3]);
        if (hour !== null) {
            return {
                date: getNextOccurrence(hour, minute),
                isRecurring: true,
                cronSchedule: `${minute} ${hour} * * *`,
                displayText: `every day at ${formatTime(hour, minute)}`,
            };
        }
    }

    // "every [weekday] at HH:MM"
    // eslint-disable-next-line max-len
    const weeklyPattern = /^every\s+(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\s+at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?$/i;
    const weeklyMatch = lowerInput.match(weeklyPattern);
    if (weeklyMatch) {
        const dayOfWeek = getDayOfWeekNumber(weeklyMatch[1]);
        const { hour, minute } = parseTimeComponents(weeklyMatch[2], weeklyMatch[3], weeklyMatch[4]);
        if (hour !== null && dayOfWeek !== null) {
            return {
                date: getNextWeekdayOccurrence(dayOfWeek, hour, minute),
                isRecurring: true,
                cronSchedule: `${minute} ${hour} * * ${dayOfWeek}`,
                displayText: `every ${weeklyMatch[1]} at ${formatTime(hour, minute)}`,
            };
        }
    }

    // "every hour"
    if (lowerInput === 'every hour') {
        const now = new Date();
        const next = new Date(now);
        next.setHours(next.getHours() + 1, 0, 0, 0);
        return {
            date: next,
            isRecurring: true,
            cronSchedule: '0 * * * *',
            displayText: 'every hour',
        };
    }

    // "every X hours"
    const hoursMatch = lowerInput.match(/^every\s+(\d+)\s+hours?$/);
    if (hoursMatch) {
        const hours = parseInt(hoursMatch[1], 10);
        if (hours >= 1 && hours <= 23) {
            const now = new Date();
            const next = new Date(now);
            next.setHours(next.getHours() + hours, 0, 0, 0);
            return {
                date: next,
                isRecurring: true,
                cronSchedule: `0 */${hours} * * *`,
                displayText: `every ${hours} hour${hours > 1 ? 's' : ''}`,
            };
        }
    }

    return null;
}

/**
 * Parse time components from regex matches
 */
function parseTimeComponents(
    hourStr: string,
    minuteStr?: string,
    period?: string,
): { hour: number | null; minute: number } {
    let hour = parseInt(hourStr, 10);
    const minute = minuteStr ? parseInt(minuteStr, 10) : 0;

    if (isNaN(hour) || hour < 0 || hour > 23) {
        return { hour: null, minute: 0 };
    }

    // Handle 12-hour format
    if (period) {
        const isPM = period.toLowerCase() === 'pm';
        if (isPM && hour !== 12) {
            hour += 12;
        } else if (!isPM && hour === 12) {
            hour = 0;
        }
    }

    return { hour, minute };
}

/**
 * Convert weekday name to cron day number (0=Sunday)
 */
function getDayOfWeekNumber(day: string): number | null {
    const days: Record<string, number> = {
        sunday: 0,
        monday: 1,
        tuesday: 2,
        wednesday: 3,
        thursday: 4,
        friday: 5,
        saturday: 6,
    };
    return days[day.toLowerCase()] ?? null;
}

/**
 * Get the next occurrence of a daily time
 */
function getNextOccurrence(hour: number, minute: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);

    if (next <= now) {
        next.setDate(next.getDate() + 1);
    }

    return next;
}

/**
 * Get the next occurrence of a weekly time
 */
function getNextWeekdayOccurrence(dayOfWeek: number, hour: number, minute: number): Date {
    const now = new Date();
    const next = new Date(now);
    next.setHours(hour, minute, 0, 0);

    const currentDay = now.getDay();
    let daysUntil = dayOfWeek - currentDay;

    if (daysUntil < 0 || (daysUntil === 0 && next <= now)) {
        daysUntil += 7;
    }

    next.setDate(next.getDate() + daysUntil);
    return next;
}

/**
 * Format a Date as relative time string
 */
export function formatRelativeTime(date: Date, referenceDate?: Date): string {
    const ref = referenceDate || new Date();
    const diff = date.getTime() - ref.getTime();

    if (diff < 0) {
        return 'in the past';
    }

    const seconds = Math.floor(diff / 1000);
    const minutes = Math.floor(seconds / 60);
    const hours = Math.floor(minutes / 60);
    const days = Math.floor(hours / 24);

    if (seconds < 60) {
        return 'in less than a minute';
    }

    if (minutes < 60) {
        return `in ${minutes} minute${minutes !== 1 ? 's' : ''}`;
    }

    if (hours < 24) {
        const remainingMinutes = minutes % 60;
        if (remainingMinutes === 0) {
            return `in ${hours} hour${hours !== 1 ? 's' : ''}`;
        }
        const hourText = `${hours} hour${hours !== 1 ? 's' : ''}`;
        const minText = `${remainingMinutes} minute${remainingMinutes !== 1 ? 's' : ''}`;
        return `in ${hourText} and ${minText}`;
    }

    if (days === 1) {
        return `tomorrow at ${formatTime(date.getHours(), date.getMinutes())}`;
    }

    if (days < 7) {
        return `in ${days} days at ${formatTime(date.getHours(), date.getMinutes())}`;
    }

    return `on ${date.toLocaleDateString()} at ${formatTime(date.getHours(), date.getMinutes())}`;
}

/**
 * Format time as HH:MM AM/PM
 */
function formatTime(hour: number, minute: number): string {
    const period = hour >= 12 ? 'PM' : 'AM';
    const displayHour = hour % 12 || 12;
    const displayMinute = minute.toString().padStart(2, '0');
    return `${displayHour}:${displayMinute} ${period}`;
}

/**
 * Validate that a date is in the future
 */
export function isFutureDate(date: Date, referenceDate?: Date): boolean {
    const ref = referenceDate || new Date();
    return date.getTime() > ref.getTime();
}

/**
 * Calculate the next execution time from a cron schedule
 * Note: This is a simplified implementation for common patterns
 */
export function getNextCronExecution(cronSchedule: string, referenceDate?: Date): Date | null {
    const ref = referenceDate || new Date();
    const parts = cronSchedule.split(' ');

    if (parts.length !== 5) {
        return null;
    }

    const [minutePart, hourPart, , , dayOfWeekPart] = parts;

    // Handle simple cases: specific minute and hour
    if (/^\d+$/.test(minutePart) && /^\d+$/.test(hourPart)) {
        const minute = parseInt(minutePart, 10);
        const hour = parseInt(hourPart, 10);

        if (dayOfWeekPart === '*') {
            // Daily
            return getNextOccurrence(hour, minute);
        } else if (/^\d+$/.test(dayOfWeekPart)) {
            // Weekly
            return getNextWeekdayOccurrence(parseInt(dayOfWeekPart, 10), hour, minute);
        }
    }

    // Handle hourly patterns like "0 */2 * * *"
    if (minutePart === '0' && hourPart.startsWith('*/')) {
        const interval = parseInt(hourPart.slice(2), 10);
        const next = new Date(ref);
        const currentHour = next.getHours();
        const nextHour = Math.ceil((currentHour + 1) / interval) * interval;
        next.setHours(nextHour, 0, 0, 0);
        return next;
    }

    return null;
}
