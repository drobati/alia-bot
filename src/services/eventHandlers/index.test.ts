import { defaultHandlers, registerDefaultHandlers, ReminderHandler } from './index';

describe('eventHandlers/index', () => {
    describe('defaultHandlers', () => {
        it('should contain ReminderHandler', () => {
            expect(defaultHandlers).toContain(ReminderHandler);
        });

        it('should have at least one handler', () => {
            expect(defaultHandlers.length).toBeGreaterThan(0);
        });
    });

    describe('registerDefaultHandlers', () => {
        it('should register all default handlers', () => {
            const mockScheduler = {
                registerHandler: jest.fn(),
            };

            registerDefaultHandlers(mockScheduler as any);

            expect(mockScheduler.registerHandler).toHaveBeenCalledTimes(defaultHandlers.length);
            expect(mockScheduler.registerHandler).toHaveBeenCalledWith(ReminderHandler);
        });
    });

    describe('exports', () => {
        it('should export ReminderHandler', () => {
            expect(ReminderHandler).toBeDefined();
            expect(ReminderHandler.type).toBe('reminder');
        });
    });
});
