import * as cron from 'node-cron';
import { Client, TextChannel, DMChannel, NewsChannel } from 'discord.js';
import { Op } from 'sequelize';
import { Context } from '../utils/types';
import {
    EventType,
    ScheduledEventAttributes,
    generateEventId,
    stringifyPayload,
    parsePayload,
} from '../models/scheduledEvent';
import {
    EventHandler,
    EventContext,
    EventResult,
    CreateEventOptions,
    ListEventOptions,
} from './eventHandlers/types';
import { getNextCronExecution } from '../utils/timeParser';

const POLLING_INTERVAL_MS = 30000; // 30 seconds

export class SchedulerService {
    private client: Client;
    private context: Context;
    private eventHandlers: Map<EventType, EventHandler> = new Map();
    private cronTasks: Map<string, cron.ScheduledTask> = new Map();
    private pollingInterval: NodeJS.Timeout | null = null;
    private isShuttingDown = false;

    constructor(client: Client, context: Context) {
        this.client = client;
        this.context = context;
    }

    /**
     * Register an event handler for a specific event type
     */
    registerHandler(handler: EventHandler): void {
        this.eventHandlers.set(handler.type, handler);
        this.context.log.debug(`Registered event handler for type: ${handler.type}`);
    }

    /**
     * Initialize the scheduler - load active events and start polling
     */
    async initialize(): Promise<void> {
        try {
            this.context.log.info(
                { category: 'scheduler_initialization' },
                'Initializing scheduler service',
            );

            // Start polling for one-time events
            this.startPolling();

            // Load and schedule recurring/cron events
            await this.loadRecurringEvents();

            this.context.log.info({
                registeredHandlers: Array.from(this.eventHandlers.keys()),
                cronTasks: this.cronTasks.size,
                category: 'scheduler_initialization',
            }, 'Scheduler service initialized');

        } catch (error) {
            this.context.log.error({
                error,
                category: 'scheduler_initialization',
            }, 'Failed to initialize scheduler service');
        }
    }

    /**
     * Start the polling interval for one-time events
     */
    private startPolling(): void {
        this.pollingInterval = setInterval(async () => {
            if (this.isShuttingDown) {return;}
            await this.processOneTimeEvents();
        }, POLLING_INTERVAL_MS);

        this.context.log.info({
            intervalMs: POLLING_INTERVAL_MS,
        }, 'Started polling for scheduled events');
    }

    /**
     * Process one-time events that are due
     */
    private async processOneTimeEvents(): Promise<void> {
        try {
            const now = new Date();

            // Find events that are due
            const dueEvents = await this.context.tables.ScheduledEvent.findAll({
                where: {
                    status: 'active',
                    scheduleType: 'once',
                    executeAt: {
                        [Op.lte]: now,
                    },
                },
                limit: 50, // Process in batches
            });

            if (dueEvents.length === 0) {return;}

            this.context.log.debug({
                count: dueEvents.length,
            }, 'Processing due one-time events');

            for (const event of dueEvents) {
                await this.executeEvent(event.get({ plain: true }) as ScheduledEventAttributes);
            }

        } catch (error) {
            this.context.log.error({
                error,
            }, 'Error processing one-time events');
        }
    }

    /**
     * Load and schedule recurring/cron events
     */
    private async loadRecurringEvents(): Promise<void> {
        try {
            const recurringEvents = await this.context.tables.ScheduledEvent.findAll({
                where: {
                    status: 'active',
                    scheduleType: ['recurring', 'cron'],
                },
            });

            for (const event of recurringEvents) {
                const plainEvent = event.get({ plain: true }) as ScheduledEventAttributes;
                if (plainEvent.cronSchedule) {
                    this.scheduleCronTask(plainEvent);
                }
            }

            this.context.log.info({
                count: recurringEvents.length,
            }, 'Loaded recurring events');

        } catch (error) {
            this.context.log.error({
                error,
            }, 'Error loading recurring events');
        }
    }

    /**
     * Schedule a cron task for a recurring event
     */
    private scheduleCronTask(event: ScheduledEventAttributes): void {
        const taskKey = `event_${event.eventId}`;

        // Stop existing task if it exists
        if (this.cronTasks.has(taskKey)) {
            const existingTask = this.cronTasks.get(taskKey);
            if (existingTask) {void existingTask.stop();}
            this.cronTasks.delete(taskKey);
        }

        if (!event.cronSchedule) {return;}

        try {
            const task = cron.schedule(event.cronSchedule, async () => {
                await this.executeEvent(event);
            }, {
                timezone: event.timezone || 'UTC',
            });

            this.cronTasks.set(taskKey, task);

            this.context.log.debug({
                eventId: event.eventId,
                cronSchedule: event.cronSchedule,
            }, 'Scheduled cron task');

        } catch (error) {
            this.context.log.error({
                eventId: event.eventId,
                cronSchedule: event.cronSchedule,
                error,
            }, 'Failed to schedule cron task');
        }
    }

    /**
     * Execute a scheduled event
     */
    private async executeEvent(event: ScheduledEventAttributes): Promise<void> {
        const startTime = Date.now();

        try {
            const handler = this.eventHandlers.get(event.eventType);
            if (!handler) {
                this.context.log.error({
                    eventId: event.eventId,
                    eventType: event.eventType,
                }, 'No handler registered for event type');
                await this.markEventFailed(event, 'No handler registered');
                return;
            }

            // Get the target channel
            let channel: TextChannel | DMChannel | NewsChannel | null = null;

            // Check if this is a DM reminder
            const payload = parsePayload(event.payload);
            const isDmReminder = event.eventType === 'reminder' &&
                'sendDm' in payload && payload.sendDm;

            if (isDmReminder) {
                // Send to DM
                try {
                    const user = await this.client.users.fetch(event.creatorId);
                    channel = await user.createDM();
                } catch {
                    this.context.log.warn({
                        eventId: event.eventId,
                        creatorId: event.creatorId,
                    }, 'Could not create DM channel');
                }
            } else if (event.channelId) {
                // Send to channel
                const fetchedChannel = this.client.channels.cache.get(event.channelId);
                if (fetchedChannel && (fetchedChannel.isTextBased())) {
                    channel = fetchedChannel as TextChannel | NewsChannel;
                }
            }

            // Build event context
            const ctx: EventContext = {
                event,
                client: this.client,
                context: this.context,
                channel,
                payload,
            };

            // Execute the handler
            const result: EventResult = await handler.execute(ctx);

            const processingTime = Date.now() - startTime;

            if (result.success) {
                this.context.log.info({
                    eventId: event.eventId,
                    eventType: event.eventType,
                    processingTimeMs: processingTime,
                }, 'Event executed successfully');

                if (result.shouldReschedule && event.scheduleType !== 'once') {
                    // Update for recurring events
                    await this.rescheduleEvent(event);
                } else {
                    // Mark one-time events as completed
                    await this.markEventCompleted(event);
                }
            } else {
                this.context.log.warn({
                    eventId: event.eventId,
                    eventType: event.eventType,
                    message: result.message,
                    processingTimeMs: processingTime,
                }, 'Event execution failed');

                await this.markEventFailed(event, result.message);
            }

        } catch (error) {
            const processingTime = Date.now() - startTime;
            this.context.log.error({
                eventId: event.eventId,
                eventType: event.eventType,
                processingTimeMs: processingTime,
                error,
            }, 'Error executing event');

            await this.markEventFailed(event, 'Execution error');
        }
    }

    /**
     * Mark an event as completed
     */
    private async markEventCompleted(event: ScheduledEventAttributes): Promise<void> {
        try {
            await this.context.tables.ScheduledEvent.update({
                status: 'completed',
                lastExecutedAt: new Date(),
                executionCount: (event.executionCount || 0) + 1,
            }, {
                where: { eventId: event.eventId },
            });
        } catch (error) {
            this.context.log.error({
                eventId: event.eventId,
                error,
            }, 'Failed to mark event as completed');
        }
    }

    /**
     * Mark an event as failed
     */
    private async markEventFailed(event: ScheduledEventAttributes, reason?: string): Promise<void> {
        try {
            await this.context.tables.ScheduledEvent.update({
                status: 'failed',
                lastExecutedAt: new Date(),
                metadata: reason ? JSON.stringify({ failureReason: reason }) : event.metadata,
            }, {
                where: { eventId: event.eventId },
            });
        } catch (error) {
            this.context.log.error({
                eventId: event.eventId,
                error,
            }, 'Failed to mark event as failed');
        }
    }

    /**
     * Reschedule a recurring event
     */
    private async rescheduleEvent(event: ScheduledEventAttributes): Promise<void> {
        try {
            // Check if max executions reached
            if (event.maxExecutions !== null &&
                event.maxExecutions !== undefined &&
                (event.executionCount || 0) + 1 >= event.maxExecutions) {
                await this.markEventCompleted(event);
                return;
            }

            // Calculate next execution time
            let nextExecuteAt: Date | null = null;

            if (event.cronSchedule) {
                nextExecuteAt = getNextCronExecution(event.cronSchedule);
            }

            await this.context.tables.ScheduledEvent.update({
                lastExecutedAt: new Date(),
                nextExecuteAt,
                executionCount: (event.executionCount || 0) + 1,
            }, {
                where: { eventId: event.eventId },
            });

        } catch (error) {
            this.context.log.error({
                eventId: event.eventId,
                error,
            }, 'Failed to reschedule event');
        }
    }

    /**
     * Schedule a new event
     */
    async scheduleEvent(options: CreateEventOptions): Promise<ScheduledEventAttributes> {
        // Generate unique event ID
        let eventId: string;
        let attempts = 0;
        do {
            eventId = generateEventId();
            attempts++;
            if (attempts > 10) {
                throw new Error('Failed to generate unique event ID');
            }
        } while (await this.context.tables.ScheduledEvent.findOne({
            where: { eventId },
        }));

        // Validate payload if handler supports it
        const handler = this.eventHandlers.get(options.eventType);
        if (handler?.validate) {
            const validation = handler.validate(options.payload);
            if (!validation.valid) {
                throw new Error(validation.error || 'Invalid payload');
            }
        }

        // Create the event
        const event = await this.context.tables.ScheduledEvent.create({
            eventId,
            guildId: options.guildId,
            channelId: options.channelId || null,
            creatorId: options.creatorId,
            eventType: options.eventType,
            payload: stringifyPayload(options.payload),
            scheduleType: options.scheduleType,
            executeAt: options.executeAt || null,
            cronSchedule: options.cronSchedule || null,
            timezone: options.timezone || 'UTC',
            status: 'active',
            nextExecuteAt: options.executeAt || (options.cronSchedule
                ? getNextCronExecution(options.cronSchedule)
                : null),
            executionCount: 0,
            maxExecutions: options.maxExecutions || null,
            metadata: options.metadata ? JSON.stringify(options.metadata) : null,
        });

        const plainEvent = event.get({ plain: true }) as ScheduledEventAttributes;

        // Schedule cron task if recurring
        if (options.scheduleType !== 'once' && options.cronSchedule) {
            this.scheduleCronTask(plainEvent);
        }

        this.context.log.info({
            eventId,
            eventType: options.eventType,
            scheduleType: options.scheduleType,
            executeAt: options.executeAt,
        }, 'Scheduled new event');

        return plainEvent;
    }

    /**
     * Cancel a scheduled event
     */
    async cancelEvent(eventId: string, userId?: string): Promise<boolean> {
        try {
            const whereClause: Record<string, unknown> = {
                eventId,
                status: 'active',
            };

            // If userId provided, ensure they own the event
            if (userId) {
                whereClause.creatorId = userId;
            }

            const event = await this.context.tables.ScheduledEvent.findOne({
                where: whereClause,
            });

            if (!event) {
                return false;
            }

            // Update status to cancelled
            await this.context.tables.ScheduledEvent.update({
                status: 'cancelled',
            }, {
                where: { eventId },
            });

            // Remove cron task if exists
            const taskKey = `event_${eventId}`;
            if (this.cronTasks.has(taskKey)) {
                const existingTask = this.cronTasks.get(taskKey);
                if (existingTask) {void existingTask.stop();}
                this.cronTasks.delete(taskKey);
            }

            this.context.log.info({
                eventId,
            }, 'Cancelled scheduled event');

            return true;

        } catch (error) {
            this.context.log.error({
                eventId,
                error,
            }, 'Failed to cancel event');
            return false;
        }
    }

    /**
     * Get a scheduled event by ID
     */
    async getEvent(eventId: string): Promise<ScheduledEventAttributes | null> {
        const event = await this.context.tables.ScheduledEvent.findOne({
            where: { eventId },
        });

        return event ? event.get({ plain: true }) as ScheduledEventAttributes : null;
    }

    /**
     * List scheduled events
     */
    async listEvents(guildId: string, options: ListEventOptions = {}): Promise<ScheduledEventAttributes[]> {
        const whereClause: Record<string, unknown> = { guildId };

        if (options.eventType) {
            whereClause.eventType = options.eventType;
        }

        if (options.creatorId) {
            whereClause.creatorId = options.creatorId;
        }

        if (options.status) {
            whereClause.status = options.status;
        } else {
            // Default to active events
            whereClause.status = 'active';
        }

        const events = await this.context.tables.ScheduledEvent.findAll({
            where: whereClause,
            order: [['executeAt', 'ASC']],
            limit: options.limit || 25,
        });

        return events.map((e: any) => e.get({ plain: true }) as ScheduledEventAttributes);
    }

    /**
     * Shutdown the scheduler service
     */
    shutdown(): void {
        this.isShuttingDown = true;

        this.context.log.info({
            cronTasks: this.cronTasks.size,
        }, 'Shutting down scheduler service');

        // Stop polling
        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }

        // Stop all cron tasks
        for (const [, task] of this.cronTasks.entries()) {
            void task.stop();
        }
        this.cronTasks.clear();
    }
}
