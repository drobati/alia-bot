import { SchedulerService } from './schedulerService';

describe('SchedulerService', () => {
    let mockClient: any;
    let mockContext: any;
    let service: SchedulerService;
    let mockScheduledEventModel: any;

    beforeEach(() => {
        jest.useFakeTimers();
        jest.clearAllMocks();

        mockScheduledEventModel = {
            findAll: jest.fn().mockResolvedValue([]),
            findOne: jest.fn().mockResolvedValue(null),
            create: jest.fn(),
            update: jest.fn().mockResolvedValue([1]),
        };

        mockClient = {
            channels: {
                cache: new Map(),
            },
            users: {
                fetch: jest.fn(),
            },
        };

        mockContext = {
            log: {
                info: jest.fn(),
                debug: jest.fn(),
                warn: jest.fn(),
                error: jest.fn(),
            },
            tables: {
                ScheduledEvent: mockScheduledEventModel,
            },
        };

        service = new SchedulerService(mockClient, mockContext);
    });

    afterEach(() => {
        service.shutdown();
        jest.useRealTimers();
    });

    describe('registerHandler', () => {
        it('should register an event handler', () => {
            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockResolvedValue({ success: true }),
            };

            service.registerHandler(mockHandler);

            expect(mockContext.log.debug).toHaveBeenCalledWith(
                expect.stringContaining('Registered event handler'),
            );
        });
    });

    describe('initialize', () => {
        it('should start polling and load recurring events', async () => {
            mockScheduledEventModel.findAll.mockResolvedValue([]);

            await service.initialize();

            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'scheduler_initialization' }),
                expect.stringContaining('Initializing'),
            );
            expect(mockScheduledEventModel.findAll).toHaveBeenCalled();
        });

        it('should handle initialization errors gracefully', async () => {
            mockScheduledEventModel.findAll.mockRejectedValue(new Error('DB error'));

            await service.initialize();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(Error) }),
                expect.any(String),
            );
        });
    });

    describe('scheduleEvent', () => {
        it('should create a one-time event', async () => {
            const mockEvent = {
                eventId: 'test1234',
                get: jest.fn().mockReturnValue({
                    eventId: 'test1234',
                    eventType: 'reminder',
                    scheduleType: 'once',
                }),
            };
            mockScheduledEventModel.create.mockResolvedValue(mockEvent);
            mockScheduledEventModel.findOne.mockResolvedValue(null);

            const result = await service.scheduleEvent({
                guildId: 'guild123',
                channelId: 'channel123',
                creatorId: 'user123',
                eventType: 'reminder',
                payload: { message: 'Test reminder', mentionUser: true, sendDm: false },
                scheduleType: 'once',
                executeAt: new Date(Date.now() + 3600000),
            });

            expect(result.eventId).toBeDefined();
            expect(mockScheduledEventModel.create).toHaveBeenCalled();
            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: expect.any(String) }),
                expect.stringContaining('Scheduled new event'),
            );
        });

        it('should validate payload with handler if available', async () => {
            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn(),
                validate: jest.fn().mockReturnValue({ valid: false, error: 'Invalid payload' }),
            };
            service.registerHandler(mockHandler);

            await expect(
                service.scheduleEvent({
                    guildId: 'guild123',
                    channelId: 'channel123',
                    creatorId: 'user123',
                    eventType: 'reminder',
                    payload: { message: '', mentionUser: true, sendDm: false },
                    scheduleType: 'once',
                    executeAt: new Date(Date.now() + 3600000),
                }),
            ).rejects.toThrow('Invalid payload');
        });

        it('should generate unique event IDs', async () => {
            const mockEvent = {
                eventId: 'unique12',
                get: jest.fn().mockReturnValue({ eventId: 'unique12' }),
            };
            mockScheduledEventModel.create.mockResolvedValue(mockEvent);
            // First call returns existing, second returns null
            mockScheduledEventModel.findOne
                .mockResolvedValueOnce({ eventId: 'existing' })
                .mockResolvedValueOnce(null);

            const result = await service.scheduleEvent({
                guildId: 'guild123',
                channelId: 'channel123',
                creatorId: 'user123',
                eventType: 'reminder',
                payload: { message: 'Test', mentionUser: true, sendDm: false },
                scheduleType: 'once',
                executeAt: new Date(Date.now() + 3600000),
            });

            expect(result.eventId).toBe('unique12');
            expect(mockScheduledEventModel.findOne).toHaveBeenCalledTimes(2);
        });
    });

    describe('cancelEvent', () => {
        it('should cancel an active event', async () => {
            const mockEvent = {
                eventId: 'test1234',
                get: jest.fn().mockReturnValue({ eventId: 'test1234' }),
            };
            mockScheduledEventModel.findOne.mockResolvedValue(mockEvent);

            const result = await service.cancelEvent('test1234', 'user123');

            expect(result).toBe(true);
            expect(mockScheduledEventModel.update).toHaveBeenCalledWith(
                { status: 'cancelled' },
                expect.objectContaining({ where: { eventId: 'test1234' } }),
            );
            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: 'test1234' }),
                expect.stringContaining('Cancelled'),
            );
        });

        it('should return false if event not found', async () => {
            mockScheduledEventModel.findOne.mockResolvedValue(null);

            const result = await service.cancelEvent('notfound', 'user123');

            expect(result).toBe(false);
        });

        it('should handle cancellation errors', async () => {
            mockScheduledEventModel.findOne.mockRejectedValue(new Error('DB error'));

            const result = await service.cancelEvent('test1234');

            expect(result).toBe(false);
            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });

    describe('getEvent', () => {
        it('should return event if found', async () => {
            const mockEvent = {
                eventId: 'test1234',
                get: jest.fn().mockReturnValue({ eventId: 'test1234', message: 'Hello' }),
            };
            mockScheduledEventModel.findOne.mockResolvedValue(mockEvent);

            const result = await service.getEvent('test1234');

            expect(result?.eventId).toBe('test1234');
        });

        it('should return null if not found', async () => {
            mockScheduledEventModel.findOne.mockResolvedValue(null);

            const result = await service.getEvent('notfound');

            expect(result).toBeNull();
        });
    });

    describe('listEvents', () => {
        it('should list active events for a guild', async () => {
            const mockEvents = [
                { get: jest.fn().mockReturnValue({ eventId: 'test1' }) },
                { get: jest.fn().mockReturnValue({ eventId: 'test2' }) },
            ];
            mockScheduledEventModel.findAll.mockResolvedValue(mockEvents);

            const result = await service.listEvents('guild123');

            expect(result).toHaveLength(2);
            expect(mockScheduledEventModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        guildId: 'guild123',
                        status: 'active',
                    }),
                }),
            );
        });

        it('should filter by event type', async () => {
            mockScheduledEventModel.findAll.mockResolvedValue([]);

            await service.listEvents('guild123', { eventType: 'reminder' });

            expect(mockScheduledEventModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        eventType: 'reminder',
                    }),
                }),
            );
        });

        it('should filter by creator', async () => {
            mockScheduledEventModel.findAll.mockResolvedValue([]);

            await service.listEvents('guild123', { creatorId: 'user123' });

            expect(mockScheduledEventModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        creatorId: 'user123',
                    }),
                }),
            );
        });
    });

    describe('shutdown', () => {
        it('should stop polling and clear cron tasks', async () => {
            await service.initialize();
            service.shutdown();

            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ cronTasks: expect.any(Number) }),
                expect.stringContaining('Shutting down'),
            );
        });
    });

    describe('polling and event processing', () => {
        it('should start polling on initialize', async () => {
            await service.initialize();

            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ intervalMs: expect.any(Number) }),
                expect.stringContaining('Started polling'),
            );
        });

        it('should process due events when polling interval triggers', async () => {
            const dueEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'due123',
                    eventType: 'reminder',
                    creatorId: 'user123',
                    channelId: 'channel123',
                    payload: JSON.stringify({ message: 'Test', mentionUser: true, sendDm: false }),
                    scheduleType: 'once',
                    status: 'active',
                }),
            };

            // First call for recurring events (initialization), second for one-time events (polling)
            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([]) // recurring events
                .mockResolvedValueOnce([dueEvent]); // one-time events

            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockResolvedValue({ success: true }),
            };
            service.registerHandler(mockHandler);

            const mockChannel = {
                isTextBased: () => true,
            };
            mockClient.channels.cache.set('channel123', mockChannel);

            await service.initialize();

            // Advance timer to trigger polling
            jest.advanceTimersByTime(35000);
            await Promise.resolve(); // Allow promises to resolve

            expect(mockScheduledEventModel.findAll).toHaveBeenCalled();
        });

        it('should handle errors during one-time event processing', async () => {
            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([]) // recurring events
                .mockRejectedValueOnce(new Error('Query failed')); // one-time events error

            await service.initialize();

            // Advance timer to trigger polling
            jest.advanceTimersByTime(35000);
            await Promise.resolve();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(Error) }),
                expect.stringContaining('Error processing one-time events'),
            );
        });
    });

    describe('recurring event handling', () => {
        it('should load and schedule recurring events with cron', async () => {
            const recurringEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'cron123',
                    eventType: 'reminder',
                    cronSchedule: '0 9 * * *',
                    scheduleType: 'recurring',
                    status: 'active',
                    timezone: 'UTC',
                }),
            };

            mockScheduledEventModel.findAll.mockResolvedValue([recurringEvent]);

            await service.initialize();

            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ count: 1 }),
                expect.stringContaining('Loaded recurring events'),
            );
        });

        it('should handle invalid cron schedules gracefully', async () => {
            const invalidCronEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'badcron',
                    eventType: 'reminder',
                    cronSchedule: 'invalid cron expression',
                    scheduleType: 'recurring',
                    status: 'active',
                }),
            };

            mockScheduledEventModel.findAll.mockResolvedValue([invalidCronEvent]);

            await service.initialize();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: 'badcron' }),
                expect.stringContaining('Failed to schedule cron task'),
            );
        });
    });

    describe('scheduleEvent with cron', () => {
        it('should schedule cron task for recurring events', async () => {
            const mockEvent = {
                eventId: 'cron456',
                get: jest.fn().mockReturnValue({
                    eventId: 'cron456',
                    eventType: 'reminder',
                    scheduleType: 'recurring',
                    cronSchedule: '0 10 * * *',
                }),
            };
            mockScheduledEventModel.create.mockResolvedValue(mockEvent);
            mockScheduledEventModel.findOne.mockResolvedValue(null);

            const result = await service.scheduleEvent({
                guildId: 'guild123',
                channelId: 'channel123',
                creatorId: 'user123',
                eventType: 'reminder',
                payload: { message: 'Daily reminder', mentionUser: true, sendDm: false },
                scheduleType: 'recurring',
                cronSchedule: '0 10 * * *',
            });

            expect(result.eventId).toBeDefined();
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                expect.objectContaining({ cronSchedule: '0 10 * * *' }),
                expect.stringContaining('Scheduled cron task'),
            );
        });
    });

    describe('listEvents with custom options', () => {
        it('should filter by custom status', async () => {
            mockScheduledEventModel.findAll.mockResolvedValue([]);

            await service.listEvents('guild123', { status: 'completed' });

            expect(mockScheduledEventModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({
                        status: 'completed',
                    }),
                }),
            );
        });

        it('should apply limit option', async () => {
            mockScheduledEventModel.findAll.mockResolvedValue([]);

            await service.listEvents('guild123', { limit: 10 });

            expect(mockScheduledEventModel.findAll).toHaveBeenCalledWith(
                expect.objectContaining({
                    limit: 10,
                }),
            );
        });
    });

    describe('cancelEvent edge cases', () => {
        it('should cancel without userId check', async () => {
            const mockEvent = {
                eventId: 'test1234',
                get: jest.fn().mockReturnValue({ eventId: 'test1234' }),
            };
            mockScheduledEventModel.findOne.mockResolvedValue(mockEvent);

            const result = await service.cancelEvent('test1234');

            expect(result).toBe(true);
            expect(mockScheduledEventModel.findOne).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.not.objectContaining({
                        creatorId: expect.anything(),
                    }),
                }),
            );
        });
    });

    describe('event execution', () => {
        it('should mark event as completed after successful execution', async () => {
            const dueEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'exec123',
                    eventType: 'reminder',
                    creatorId: 'user123',
                    channelId: 'channel123',
                    payload: JSON.stringify({ message: 'Test', mentionUser: true, sendDm: false }),
                    scheduleType: 'once',
                    status: 'active',
                    executionCount: 0,
                }),
            };

            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([dueEvent]);

            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockResolvedValue({ success: true, shouldReschedule: false }),
            };
            service.registerHandler(mockHandler);

            const mockChannel = {
                isTextBased: () => true,
                send: jest.fn().mockResolvedValue({}),
            };
            mockClient.channels.cache.set('channel123', mockChannel);

            await service.initialize();
            jest.advanceTimersByTime(35000);
            await Promise.resolve();
            await Promise.resolve();

            expect(mockHandler.execute).toHaveBeenCalled();
        });

        it('should log error when no handler registered for event type', async () => {
            const orphanEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'orphan123',
                    eventType: 'unknown' as any,
                    creatorId: 'user123',
                    channelId: 'channel123',
                    payload: '{}',
                    scheduleType: 'once',
                    status: 'active',
                }),
            };

            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([orphanEvent]);

            await service.initialize();
            jest.advanceTimersByTime(35000);
            await Promise.resolve();
            await Promise.resolve();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: 'orphan123' }),
                expect.stringContaining('No handler registered'),
            );
        });

        it('should handle DM reminders', async () => {
            const dmEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'dm123',
                    eventType: 'reminder',
                    creatorId: 'user123',
                    channelId: null,
                    payload: JSON.stringify({
                        message: 'DM reminder',
                        mentionUser: true,
                        sendDm: true,
                    }),
                    scheduleType: 'once',
                    status: 'active',
                }),
            };

            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([dmEvent]);

            const mockDmChannel = {
                send: jest.fn().mockResolvedValue({}),
            };
            const mockUser = {
                createDM: jest.fn().mockResolvedValue(mockDmChannel),
            };
            mockClient.users.fetch.mockResolvedValue(mockUser);

            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockResolvedValue({ success: true }),
            };
            service.registerHandler(mockHandler);

            await service.initialize();
            jest.advanceTimersByTime(35000);
            await Promise.resolve();
            await Promise.resolve();

            expect(mockClient.users.fetch).toHaveBeenCalledWith('user123');
        });

        it('should log warning when DM channel cannot be created', async () => {
            const dmEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'dmerr123',
                    eventType: 'reminder',
                    creatorId: 'user123',
                    channelId: null,
                    payload: JSON.stringify({
                        message: 'DM reminder',
                        mentionUser: true,
                        sendDm: true,
                    }),
                    scheduleType: 'once',
                    status: 'active',
                }),
            };

            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([dmEvent]);

            mockClient.users.fetch.mockRejectedValue(new Error('User not found'));

            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockResolvedValue({ success: false }),
            };
            service.registerHandler(mockHandler);

            await service.initialize();
            jest.advanceTimersByTime(35000);
            await Promise.resolve();
            await Promise.resolve();

            expect(mockContext.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: 'dmerr123' }),
                expect.stringContaining('Could not create DM channel'),
            );
        });

        it('should handle failed event execution', async () => {
            const failEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'fail123',
                    eventType: 'reminder',
                    creatorId: 'user123',
                    channelId: 'channel123',
                    payload: JSON.stringify({ message: 'Test', mentionUser: true, sendDm: false }),
                    scheduleType: 'once',
                    status: 'active',
                }),
            };

            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([failEvent]);

            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockResolvedValue({ success: false, message: 'Handler failed' }),
            };
            service.registerHandler(mockHandler);

            const mockChannel = { isTextBased: () => true };
            mockClient.channels.cache.set('channel123', mockChannel);

            await service.initialize();
            jest.advanceTimersByTime(35000);
            await Promise.resolve();
            await Promise.resolve();

            expect(mockContext.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: 'fail123' }),
                expect.stringContaining('Event execution failed'),
            );
        });

        it('should handle exception during event execution', async () => {
            const errorEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'error123',
                    eventType: 'reminder',
                    creatorId: 'user123',
                    channelId: 'channel123',
                    payload: JSON.stringify({ message: 'Test', mentionUser: true, sendDm: false }),
                    scheduleType: 'once',
                    status: 'active',
                }),
            };

            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([errorEvent]);

            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockRejectedValue(new Error('Handler crashed')),
            };
            service.registerHandler(mockHandler);

            const mockChannel = { isTextBased: () => true };
            mockClient.channels.cache.set('channel123', mockChannel);

            await service.initialize();
            jest.advanceTimersByTime(35000);
            await Promise.resolve();
            await Promise.resolve();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ eventId: 'error123' }),
                expect.stringContaining('Error executing event'),
            );
        });
    });

    describe('rescheduling', () => {
        it('should reschedule recurring event after successful execution', async () => {
            const recurringEvent = {
                get: jest.fn().mockReturnValue({
                    eventId: 'recur123',
                    eventType: 'reminder',
                    creatorId: 'user123',
                    channelId: 'channel123',
                    payload: JSON.stringify({ message: 'Daily', mentionUser: true, sendDm: false }),
                    scheduleType: 'recurring',
                    cronSchedule: '0 9 * * *',
                    status: 'active',
                    executionCount: 0,
                    maxExecutions: null,
                }),
            };

            mockScheduledEventModel.findAll
                .mockResolvedValueOnce([])
                .mockResolvedValueOnce([recurringEvent]);

            const mockHandler = {
                type: 'reminder' as const,
                execute: jest.fn().mockResolvedValue({ success: true, shouldReschedule: true }),
            };
            service.registerHandler(mockHandler);

            const mockChannel = { isTextBased: () => true };
            mockClient.channels.cache.set('channel123', mockChannel);

            await service.initialize();
            jest.advanceTimersByTime(35000);
            await Promise.resolve();
            await Promise.resolve();

            expect(mockScheduledEventModel.update).toHaveBeenCalled();
        });
    });

    describe('max executions', () => {
        it('should fail to generate unique ID after too many attempts', async () => {
            // All findOne calls return existing event
            mockScheduledEventModel.findOne.mockResolvedValue({ eventId: 'existing' });

            await expect(
                service.scheduleEvent({
                    guildId: 'guild123',
                    channelId: 'channel123',
                    creatorId: 'user123',
                    eventType: 'reminder',
                    payload: { message: 'Test', mentionUser: true, sendDm: false },
                    scheduleType: 'once',
                    executeAt: new Date(Date.now() + 3600000),
                }),
            ).rejects.toThrow('Failed to generate unique event ID');
        });
    });
});
