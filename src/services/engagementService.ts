import { Context } from '../utils/types';
import * as cron from 'node-cron';
import { Op } from 'sequelize';

interface BufferedStats {
    username: string;
    messages: number;
    commands: number;
    lastActive: Date;
}

export class EngagementService {
    private context: Context;
    private statsBuffer: Map<string, BufferedStats> = new Map();
    private flushTask: cron.ScheduledTask | null = null;
    private readonly FLUSH_INTERVAL = '* * * * *'; // Every minute

    constructor(context: Context) {
        this.context = context;
    }

    /**
     * Initialize the service and start the flush scheduler
     */
    initialize(): void {
        this.flushTask = cron.schedule(this.FLUSH_INTERVAL, () => {
            this.flushStats().catch(err => {
                this.context.log.error({ error: err, category: 'engagement' }, 'Failed to flush engagement stats');
            });
        });

        this.context.log.info({ category: 'service_initialization' }, 'Engagement service initialized');
    }

    /**
     * Track a message from a user - O(1) in-memory operation
     */
    trackMessage(guildId: string, userId: string, username: string): void {
        const key = `${guildId}:${userId}`;
        const current = this.statsBuffer.get(key) || {
            username,
            messages: 0,
            commands: 0,
            lastActive: new Date(),
        };

        this.statsBuffer.set(key, {
            username,
            messages: current.messages + 1,
            commands: current.commands,
            lastActive: new Date(),
        });
    }

    /**
     * Track a command usage from a user - O(1) in-memory operation
     */
    trackCommand(guildId: string, userId: string, username: string): void {
        const key = `${guildId}:${userId}`;
        const current = this.statsBuffer.get(key) || {
            username,
            messages: 0,
            commands: 0,
            lastActive: new Date(),
        };

        this.statsBuffer.set(key, {
            username,
            messages: current.messages,
            commands: current.commands + 1,
            lastActive: new Date(),
        });
    }

    /**
     * Flush buffered stats to database - single bulk upsert
     */
    async flushStats(): Promise<void> {
        if (this.statsBuffer.size === 0) {
            return;
        }

        const { tables, log } = this.context;
        const UserStats = tables.UserStats;

        if (!UserStats) {
            log.error({ category: 'engagement' }, 'UserStats model not available');
            return;
        }

        const entries = [...this.statsBuffer.entries()];
        const now = new Date();

        try {
            // Process each entry with upsert
            for (const [key, data] of entries) {
                const [guildId, userId] = key.split(':');

                const existing = await UserStats.findOne({
                    where: { guildId, userId },
                });

                if (existing) {
                    await existing.update({
                        username: data.username,
                        messageCount: existing.getDataValue('messageCount') + data.messages,
                        commandCount: existing.getDataValue('commandCount') + data.commands,
                        lastActive: data.lastActive,
                    });
                } else {
                    await UserStats.create({
                        guildId,
                        userId,
                        username: data.username,
                        messageCount: data.messages,
                        commandCount: data.commands,
                        lastActive: data.lastActive,
                        firstSeen: now,
                    });
                }
            }

            log.debug({
                category: 'engagement',
                flushedCount: entries.length,
            }, 'Flushed engagement stats to database');

            // Clear the buffer after successful flush
            this.statsBuffer.clear();
        } catch (error) {
            log.error({ error, category: 'engagement' }, 'Error flushing engagement stats');
            // Don't clear buffer on error - will retry next flush
        }
    }

    /**
     * Get leaderboard for a guild
     */
    async getLeaderboard(guildId: string, limit = 10): Promise<Array<{
        userId: string;
        username: string;
        messageCount: number;
        commandCount: number;
        lastActive: Date;
    }>> {
        const { tables } = this.context;
        const UserStats = tables.UserStats;

        if (!UserStats) {
            return [];
        }

        const stats = await UserStats.findAll({
            where: { guildId },
            order: [['messageCount', 'DESC']],
            limit,
        });

        return stats.map(stat => ({
            userId: stat.getDataValue('userId'),
            username: stat.getDataValue('username'),
            messageCount: stat.getDataValue('messageCount'),
            commandCount: stat.getDataValue('commandCount'),
            lastActive: stat.getDataValue('lastActive'),
        }));
    }

    /**
     * Get stats for a specific user
     */
    async getUserStats(guildId: string, userId: string): Promise<{
        userId: string;
        username: string;
        messageCount: number;
        commandCount: number;
        lastActive: Date;
        firstSeen: Date;
        rank: number;
    } | null> {
        const { tables } = this.context;
        const UserStats = tables.UserStats;

        if (!UserStats) {
            return null;
        }

        const stat = await UserStats.findOne({
            where: { guildId, userId },
        });

        if (!stat) {
            return null;
        }

        // Get rank
        const rank = await UserStats.count({
            where: {
                guildId,
                messageCount: {
                    [Op.gt]: stat.getDataValue('messageCount'),
                },
            },
        }) + 1;

        return {
            userId: stat.getDataValue('userId'),
            username: stat.getDataValue('username'),
            messageCount: stat.getDataValue('messageCount'),
            commandCount: stat.getDataValue('commandCount'),
            lastActive: stat.getDataValue('lastActive'),
            firstSeen: stat.getDataValue('firstSeen') || new Date(),
            rank,
        };
    }

    /**
     * Get buffer size for monitoring
     */
    getBufferSize(): number {
        return this.statsBuffer.size;
    }

    /**
     * Shutdown the service - flush remaining stats and stop scheduler
     */
    async shutdown(): Promise<void> {
        this.context.log.info({ category: 'engagement' }, 'Shutting down engagement service');

        // Stop the scheduled task
        if (this.flushTask) {
            this.flushTask.stop();
            this.flushTask = null;
        }

        // Final flush
        await this.flushStats();
    }
}
