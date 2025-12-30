import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes, CreationOptional } from "sequelize";

// Event type definitions
export type EventType = 'reminder' | 'birthday' | 'hype' | 'tips';
export type ScheduleType = 'once' | 'recurring' | 'cron';
export type EventStatus = 'pending' | 'active' | 'completed' | 'cancelled' | 'failed';

// Payload interfaces for different event types
export interface ReminderPayload {
    message: string;
    mentionUser: boolean;
    sendDm: boolean;
}

export interface BirthdayPayload {
    userId: string;
    username: string;
    birthDate: string; // MM-DD format
    customMessage?: string;
}

export interface HypePayload {
    eventName: string;
    description?: string;
    showCountdown: boolean;
    announceAt: string[]; // Array of "24h", "1h", "15m" etc.
}

export interface TipsPayload {
    category?: string;
    channelIds: string[];
}

export type EventPayload = ReminderPayload | BirthdayPayload | HypePayload | TipsPayload;

export interface ScheduledEventAttributes {
    id?: number;
    eventId: string;
    guildId: string;
    channelId?: string | null;
    creatorId: string;
    eventType: EventType;
    payload: string; // JSON stringified
    scheduleType: ScheduleType;
    executeAt?: Date | null;
    cronSchedule?: string | null;
    timezone: string;
    status: EventStatus;
    lastExecutedAt?: Date | null;
    nextExecuteAt?: Date | null;
    executionCount: number;
    maxExecutions?: number | null;
    metadata?: string | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface ScheduledEventModel extends Model<
    InferAttributes<ScheduledEventModel>,
    InferCreationAttributes<ScheduledEventModel>
> {
    id: CreationOptional<number>;
    eventId: string;
    guildId: string;
    channelId: string | null;
    creatorId: string;
    eventType: EventType;
    payload: string;
    scheduleType: ScheduleType;
    executeAt: Date | null;
    cronSchedule: string | null;
    timezone: string;
    status: CreationOptional<EventStatus>;
    lastExecutedAt: Date | null;
    nextExecuteAt: Date | null;
    executionCount: CreationOptional<number>;
    maxExecutions: number | null;
    metadata: string | null;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

export default (sequelize: Sequelize) => ({
    ScheduledEvent: sequelize.define<ScheduledEventModel>('scheduled_events', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        eventId: {
            type: DataTypes.STRING(8),
            allowNull: false,
            unique: true,
            field: 'event_id',
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'guild_id',
        },
        channelId: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'channel_id',
        },
        creatorId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'creator_id',
        },
        eventType: {
            type: DataTypes.ENUM('reminder', 'birthday', 'hype', 'tips'),
            allowNull: false,
            field: 'event_type',
        },
        payload: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        scheduleType: {
            type: DataTypes.ENUM('once', 'recurring', 'cron'),
            allowNull: false,
            field: 'schedule_type',
        },
        executeAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'execute_at',
        },
        cronSchedule: {
            type: DataTypes.STRING,
            allowNull: true,
            field: 'cron_schedule',
        },
        timezone: {
            type: DataTypes.STRING(50),
            allowNull: false,
            defaultValue: 'UTC',
        },
        status: {
            type: DataTypes.ENUM('pending', 'active', 'completed', 'cancelled', 'failed'),
            allowNull: false,
            defaultValue: 'active',
        },
        lastExecutedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'last_executed_at',
        },
        nextExecuteAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'next_execute_at',
        },
        executionCount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            field: 'execution_count',
        },
        maxExecutions: {
            type: DataTypes.INTEGER,
            allowNull: true,
            field: 'max_executions',
        },
        metadata: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        createdAt: {
            type: DataTypes.DATE,
            field: 'created_at',
        },
        updatedAt: {
            type: DataTypes.DATE,
            field: 'updated_at',
        },
    }, {
        timestamps: true,
        underscored: true,
        indexes: [
            {
                // For polling active events that are due
                fields: ['status', 'next_execute_at'],
                name: 'idx_status_next_execute',
            },
            {
                // For guild-based queries
                fields: ['guild_id'],
                name: 'idx_guild',
            },
            {
                // For user's events by type (e.g., list my reminders)
                fields: ['creator_id', 'event_type'],
                name: 'idx_creator_type',
            },
            {
                // For type-based queries
                fields: ['event_type'],
                name: 'idx_type',
            },
        ],
    }),
});

/**
 * Helper function to parse the payload JSON
 */
export function parsePayload<T extends EventPayload>(payloadString: string): T {
    return JSON.parse(payloadString) as T;
}

/**
 * Helper function to stringify the payload
 */
export function stringifyPayload(payload: EventPayload): string {
    return JSON.stringify(payload);
}

/**
 * Generate a unique 8-character event ID
 */
export function generateEventId(): string {
    const chars = '0123456789abcdefghijklmnopqrstuvwxyz';
    let result = '';
    for (let i = 0; i < 8; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}
