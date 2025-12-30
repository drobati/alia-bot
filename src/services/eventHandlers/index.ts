import { SchedulerService } from '../schedulerService';
import { ReminderHandler } from './reminderHandler';
import { EventHandler } from './types';

// Export all handlers
export { ReminderHandler } from './reminderHandler';

// Export types
export * from './types';

/**
 * List of all default event handlers
 */
export const defaultHandlers: EventHandler[] = [
    ReminderHandler,
    // Future handlers: BirthdayHandler, HypeHandler, TipsHandler
];

/**
 * Register all default handlers with the scheduler service
 */
export function registerDefaultHandlers(scheduler: SchedulerService): void {
    for (const handler of defaultHandlers) {
        scheduler.registerHandler(handler);
    }
}
