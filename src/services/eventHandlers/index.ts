import { SchedulerService } from '../schedulerService';
import { ReminderHandler } from './reminderHandler';
import { HypeHandler } from './hypeHandler';
import { BirthdayHandler } from './birthdayHandler';
import { EventHandler } from './types';

// Export all handlers
export { ReminderHandler } from './reminderHandler';
export { HypeHandler } from './hypeHandler';
export { BirthdayHandler } from './birthdayHandler';

// Export types
export * from './types';

/**
 * List of all default event handlers
 */
export const defaultHandlers: EventHandler[] = [
    ReminderHandler,
    HypeHandler,
    BirthdayHandler,
    // Future handlers: TipsHandler
];

/**
 * Register all default handlers with the scheduler service
 */
export function registerDefaultHandlers(scheduler: SchedulerService): void {
    for (const handler of defaultHandlers) {
        scheduler.registerHandler(handler);
    }
}
