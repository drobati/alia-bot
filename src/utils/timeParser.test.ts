import { parseTimeInput, formatRelativeTime, isFutureDate, getNextCronExecution } from './timeParser';

describe('utils/timeParser', () => {
    // Use a fixed reference date for consistent testing
    const referenceDate = new Date('2025-01-15T10:00:00.000Z');

    describe('parseTimeInput', () => {
        describe('one-time natural language parsing', () => {
            it('should parse "in 2 hours"', () => {
                const result = parseTimeInput('in 2 hours', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(false);
                expect(result!.date.getTime()).toBeGreaterThan(referenceDate.getTime());
                // Should be approximately 2 hours later
                const diff = result!.date.getTime() - referenceDate.getTime();
                expect(diff).toBeGreaterThanOrEqual(2 * 60 * 60 * 1000 - 60000); // Allow 1 min tolerance
                expect(diff).toBeLessThanOrEqual(2 * 60 * 60 * 1000 + 60000);
            });

            it('should parse "in 30 minutes"', () => {
                const result = parseTimeInput('in 30 minutes', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(false);
                const diff = result!.date.getTime() - referenceDate.getTime();
                expect(diff).toBeGreaterThanOrEqual(30 * 60 * 1000 - 60000);
                expect(diff).toBeLessThanOrEqual(30 * 60 * 1000 + 60000);
            });

            it('should parse "tomorrow at 3pm"', () => {
                const result = parseTimeInput('tomorrow at 3pm', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(false);
                expect(result!.date.getTime()).toBeGreaterThan(referenceDate.getTime());
            });

            it('should parse "next friday at noon"', () => {
                const result = parseTimeInput('next friday at noon', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(false);
                expect(result!.date.getTime()).toBeGreaterThan(referenceDate.getTime());
            });

            it('should return null for invalid input', () => {
                const result = parseTimeInput('not a valid time', referenceDate);
                expect(result).toBeNull();
            });

            it('should return null for empty input', () => {
                const result = parseTimeInput('', referenceDate);
                expect(result).toBeNull();
            });
        });

        describe('recurring pattern parsing', () => {
            it('should parse "every day at 9am"', () => {
                const result = parseTimeInput('every day at 9am', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 9 * * *');
                expect(result!.displayText).toBe('every day at 9:00 AM');
            });

            it('should parse "every day at 3pm"', () => {
                const result = parseTimeInput('every day at 3pm', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 15 * * *');
                expect(result!.displayText).toBe('every day at 3:00 PM');
            });

            it('should parse "every day at 14:30"', () => {
                const result = parseTimeInput('every day at 14:30', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('30 14 * * *');
            });

            it('should parse "every monday at 10am"', () => {
                const result = parseTimeInput('every monday at 10am', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 10 * * 1');
                expect(result!.displayText).toBe('every monday at 10:00 AM');
            });

            it('should parse "every friday at 5pm"', () => {
                const result = parseTimeInput('every friday at 5pm', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 17 * * 5');
            });

            it('should parse "every sunday at 12pm"', () => {
                const result = parseTimeInput('every sunday at 12pm', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 12 * * 0');
            });

            it('should parse "every hour"', () => {
                const result = parseTimeInput('every hour', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 * * * *');
                expect(result!.displayText).toBe('every hour');
            });

            it('should parse "every 2 hours"', () => {
                const result = parseTimeInput('every 2 hours', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 */2 * * *');
                expect(result!.displayText).toBe('every 2 hours');
            });

            it('should parse "every 6 hours"', () => {
                const result = parseTimeInput('every 6 hours', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
                expect(result!.cronSchedule).toBe('0 */6 * * *');
            });
        });

        describe('case insensitivity', () => {
            it('should handle uppercase input', () => {
                const result = parseTimeInput('EVERY DAY AT 9AM', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
            });

            it('should handle mixed case input', () => {
                const result = parseTimeInput('Every Monday at 10AM', referenceDate);
                expect(result).not.toBeNull();
                expect(result!.isRecurring).toBe(true);
            });
        });
    });

    describe('formatRelativeTime', () => {
        it('should format time in the past', () => {
            const pastDate = new Date(referenceDate.getTime() - 60000);
            const result = formatRelativeTime(pastDate, referenceDate);
            expect(result).toBe('in the past');
        });

        it('should format less than a minute', () => {
            const soonDate = new Date(referenceDate.getTime() + 30000);
            const result = formatRelativeTime(soonDate, referenceDate);
            expect(result).toBe('in less than a minute');
        });

        it('should format minutes', () => {
            const futureDate = new Date(referenceDate.getTime() + 15 * 60 * 1000);
            const result = formatRelativeTime(futureDate, referenceDate);
            expect(result).toBe('in 15 minutes');
        });

        it('should format single minute correctly', () => {
            const futureDate = new Date(referenceDate.getTime() + 1 * 60 * 1000);
            const result = formatRelativeTime(futureDate, referenceDate);
            expect(result).toBe('in 1 minute');
        });

        it('should format hours', () => {
            const futureDate = new Date(referenceDate.getTime() + 3 * 60 * 60 * 1000);
            const result = formatRelativeTime(futureDate, referenceDate);
            expect(result).toBe('in 3 hours');
        });

        it('should format hours and minutes', () => {
            const futureDate = new Date(referenceDate.getTime() + (2 * 60 + 30) * 60 * 1000);
            const result = formatRelativeTime(futureDate, referenceDate);
            expect(result).toBe('in 2 hours and 30 minutes');
        });

        it('should format tomorrow', () => {
            const tomorrow = new Date(referenceDate);
            tomorrow.setDate(tomorrow.getDate() + 1);
            tomorrow.setHours(15, 0, 0, 0);
            const result = formatRelativeTime(tomorrow, referenceDate);
            expect(result).toContain('tomorrow at');
        });

        it('should format days', () => {
            const futureDate = new Date(referenceDate.getTime() + 3 * 24 * 60 * 60 * 1000);
            const result = formatRelativeTime(futureDate, referenceDate);
            expect(result).toContain('in 3 days at');
        });

        it('should format weeks as date', () => {
            const futureDate = new Date(referenceDate.getTime() + 10 * 24 * 60 * 60 * 1000);
            const result = formatRelativeTime(futureDate, referenceDate);
            expect(result).toContain('on');
        });
    });

    describe('isFutureDate', () => {
        it('should return true for future dates', () => {
            const futureDate = new Date(referenceDate.getTime() + 60000);
            expect(isFutureDate(futureDate, referenceDate)).toBe(true);
        });

        it('should return false for past dates', () => {
            const pastDate = new Date(referenceDate.getTime() - 60000);
            expect(isFutureDate(pastDate, referenceDate)).toBe(false);
        });

        it('should return false for current time', () => {
            expect(isFutureDate(referenceDate, referenceDate)).toBe(false);
        });
    });

    describe('getNextCronExecution', () => {
        it('should calculate next daily execution', () => {
            const result = getNextCronExecution('0 9 * * *', referenceDate);
            expect(result).not.toBeNull();
            expect(result!.getHours()).toBe(9);
            expect(result!.getMinutes()).toBe(0);
        });

        it('should calculate next weekly execution', () => {
            const result = getNextCronExecution('0 10 * * 1', referenceDate);
            expect(result).not.toBeNull();
            expect(result!.getDay()).toBe(1); // Monday
            expect(result!.getHours()).toBe(10);
        });

        it('should calculate next hourly interval execution', () => {
            const result = getNextCronExecution('0 */2 * * *', referenceDate);
            expect(result).not.toBeNull();
            expect(result!.getTime()).toBeGreaterThan(referenceDate.getTime());
        });

        it('should return null for invalid cron', () => {
            const result = getNextCronExecution('invalid', referenceDate);
            expect(result).toBeNull();
        });

        it('should return null for incomplete cron', () => {
            const result = getNextCronExecution('0 9 *', referenceDate);
            expect(result).toBeNull();
        });
    });
});
