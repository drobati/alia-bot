import * as cron from 'node-cron';
import { Client, TextChannel } from 'discord.js';
import { Context } from '../utils/types';
import { generateMotivationalMessage, MotivationalRateLimiter } from '../utils/motivationalGenerator';

export class MotivationalScheduler {
    private client: Client;
    private context: Context;
    private scheduledTasks: Map<string, cron.ScheduledTask> = new Map();

    constructor(client: Client, context: Context) {
        this.client = client;
        this.context = context;
    }

    /**
     * Initialize all scheduled motivational messages from the database
     */
    async initialize(): Promise<void> {
        try {
            this.context.log.info(
                { category: 'scheduler_initialization' },
                'Initializing motivational message scheduler',
            );

            const startTime = Date.now();
            const configs = await this.context.tables.MotivationalConfig.findAll({
                where: { isActive: true },
            });
            const duration = Date.now() - startTime;

            this.context.log.logDatabaseOperation({
                operation: 'findAll',
                table: 'MotivationalConfig',
                duration,
                recordsAffected: configs.length,
            });

            for (const config of configs) {
                await this.scheduleMotivationalMessage(config);
            }

            // Schedule cleanup task for rate limiter
            this.scheduleCleanupTask();

            this.context.log.info({
                activeConfigs: configs.length,
                scheduledTasks: this.scheduledTasks.size,
                category: 'scheduler_initialization',
            }, 'Motivational scheduler initialized');

        } catch (error) {
            this.context.log.error({
                error,
                category: 'scheduler_initialization',
            }, 'Failed to initialize motivational scheduler');
        }
    }

    /**
     * Schedule a motivational message for a specific configuration
     */
    async scheduleMotivationalMessage(config: any): Promise<void> {
        const taskKey = `motivational_${config.channelId}`;

        // Stop existing task if it exists
        if (this.scheduledTasks.has(taskKey)) {
            this.scheduledTasks.get(taskKey)?.stop();
            this.scheduledTasks.delete(taskKey);
        }

        if (!config.isActive) {
            this.context.log.debug('Skipping inactive motivational config', {
                channelId: config.channelId,
                guildId: config.guildId,
            });
            return;
        }

        try {
            const task = cron.schedule(config.cronSchedule, async () => {
                await this.sendMotivationalMessage(config);
            }, {
                timezone: 'UTC', // Use UTC for consistency
            });

            this.scheduledTasks.set(taskKey, task);

            this.context.log.info('Scheduled motivational message', {
                channelId: config.channelId,
                guildId: config.guildId,
                schedule: config.cronSchedule,
                frequency: config.frequency,
                category: config.category,
            });

        } catch (error) {
            this.context.log.error('Failed to schedule motivational message', {
                channelId: config.channelId,
                guildId: config.guildId,
                schedule: config.cronSchedule,
                error,
            });
        }
    }

    /**
     * Send a motivational message to a specific channel
     */
    private async sendMotivationalMessage(config: any): Promise<void> {
        const startTime = Date.now();

        try {
            // Check rate limiting
            if (!MotivationalRateLimiter.canSendMessage(config.channelId)) {
                this.context.log.warn('Motivational message rate limited', {
                    channelId: config.channelId,
                    guildId: config.guildId,
                });
                return;
            }

            // Get the channel
            const channel = this.client.channels.cache.get(config.channelId) as TextChannel;
            if (!channel) {
                this.context.log.warn('Channel not found for motivational message', {
                    channelId: config.channelId,
                    guildId: config.guildId,
                });
                return;
            }

            // Check if we can send messages to this channel
            if (!channel.permissionsFor(this.client.user!)?.has(['SendMessages', 'ViewChannel'])) {
                this.context.log.warn('Insufficient permissions to send motivational message', {
                    channelId: config.channelId,
                    guildId: config.guildId,
                });
                return;
            }

            // Generate the motivational message
            const message = await generateMotivationalMessage({
                category: config.category,
                frequency: config.frequency,
            }, this.context);

            if (!message) {
                this.context.log.error('Failed to generate motivational message', {
                    channelId: config.channelId,
                    guildId: config.guildId,
                    category: config.category,
                    frequency: config.frequency,
                });
                return;
            }

            // Send the message
            await channel.send(message);

            // Mark message as sent for rate limiting
            MotivationalRateLimiter.markMessageSent(config.channelId);

            const processingTime = Date.now() - startTime;

            this.context.log.info('Motivational message sent successfully', {
                channelId: config.channelId,
                guildId: config.guildId,
                category: config.category,
                frequency: config.frequency,
                messageLength: message.length,
                processingTimeMs: processingTime,
            });

        } catch (error) {
            const processingTime = Date.now() - startTime;

            this.context.log.error('Failed to send motivational message', {
                channelId: config.channelId,
                guildId: config.guildId,
                category: config.category,
                frequency: config.frequency,
                processingTimeMs: processingTime,
                error,
            });
        }
    }

    /**
     * Update a scheduled task when configuration changes
     */
    async updateSchedule(channelId: string): Promise<void> {
        try {
            const config = await this.context.tables.MotivationalConfig.findOne({
                where: { channelId, isActive: true },
            });

            if (config) {
                await this.scheduleMotivationalMessage(config);
                this.context.log.info('Updated motivational message schedule', {
                    channelId,
                    schedule: config.cronSchedule,
                });
            } else {
                // Remove schedule if config is inactive or deleted
                await this.removeSchedule(channelId);
            }

        } catch (error) {
            this.context.log.error('Failed to update motivational message schedule', {
                channelId,
                error,
            });
        }
    }

    /**
     * Remove a scheduled task
     */
    async removeSchedule(channelId: string): Promise<void> {
        const taskKey = `motivational_${channelId}`;

        if (this.scheduledTasks.has(taskKey)) {
            this.scheduledTasks.get(taskKey)?.stop();
            this.scheduledTasks.delete(taskKey);

            this.context.log.info('Removed motivational message schedule', {
                channelId,
            });
        }
    }

    /**
     * Schedule periodic cleanup task
     */
    private scheduleCleanupTask(): void {
        // Run cleanup every hour
        cron.schedule('0 * * * *', () => {
            MotivationalRateLimiter.cleanup();
            this.context.log.debug('Performed motivational rate limiter cleanup');
        });
    }

    /**
     * Get status of all scheduled tasks
     */
    getScheduleStatus(): Array<{channelId: string, scheduled: boolean}> {
        const status = [];

        for (const [taskKey] of this.scheduledTasks.entries()) {
            const channelId = taskKey.replace('motivational_', '');
            status.push({
                channelId,
                scheduled: true, // Task exists in map, so it's scheduled
            });
        }

        return status;
    }

    /**
     * Shutdown all scheduled tasks
     */
    shutdown(): void {
        this.context.log.info('Shutting down motivational scheduler', {
            activeTasks: this.scheduledTasks.size,
        });

        for (const [, task] of this.scheduledTasks.entries()) {
            task.stop();
        }

        this.scheduledTasks.clear();
    }
}