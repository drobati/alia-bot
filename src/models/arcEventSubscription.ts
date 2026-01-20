import { DataTypes } from 'sequelize';

export interface ArcEventSubscriptionAttributes {
    id: number;
    guild_id: string;
    user_id: string;
    username: string | null;
    event_types: string | null; // JSON array of event types, null = all
    maps: string | null; // JSON array of maps, null = all
    warn_minutes: string; // JSON array of warning times in minutes
    notify_dm: boolean;
    notify_channel: boolean;
    active: boolean;
    created_at: Date;
    updated_at: Date;
}

export const parseEventTypes = (json: string | null): string[] | null => {
    if (!json) {return null;}
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
};

export const parseMaps = (json: string | null): string[] | null => {
    if (!json) {return null;}
    try {
        return JSON.parse(json);
    } catch {
        return null;
    }
};

export const parseWarnMinutes = (json: string): number[] => {
    try {
        return JSON.parse(json);
    } catch {
        return [15]; // Default to 15 minutes
    }
};

export default (sequelize: any) => ({
    ArcEventSubscription: sequelize.define('ArcEventSubscription', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        event_types: {
            type: DataTypes.TEXT,
            allowNull: true, // null = all events
            comment: 'JSON array of event types to track, null means all',
        },
        maps: {
            type: DataTypes.TEXT,
            allowNull: true, // null = all maps
            comment: 'JSON array of maps to track, null means all',
        },
        warn_minutes: {
            type: DataTypes.TEXT,
            allowNull: false,
            defaultValue: '[15]',
            comment: 'JSON array of minutes before event to warn',
        },
        notify_dm: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        notify_channel: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'arc_event_subscriptions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['guild_id'],
                name: 'arc_event_subs_guild_idx',
            },
            {
                fields: ['guild_id', 'user_id'],
                name: 'arc_event_subs_guild_user_idx',
            },
            {
                fields: ['guild_id', 'active'],
                name: 'arc_event_subs_guild_active_idx',
            },
            {
                unique: true,
                fields: ['guild_id', 'user_id'],
                name: 'arc_event_subs_unique_user',
            },
        ],
    }),
});
