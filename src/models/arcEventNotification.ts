import { DataTypes } from 'sequelize';

export interface ArcEventNotificationAttributes {
    id: number;
    guild_id: string;
    user_id: string;
    event_name: string;
    event_map: string;
    event_start_time: number; // Unix timestamp ms
    warn_minutes: number;
    notification_type: 'dm' | 'channel';
    sent_at: Date;
}

export default (sequelize: any) => ({
    ArcEventNotification: sequelize.define('ArcEventNotification', {
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
        event_name: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        event_map: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        event_start_time: {
            type: DataTypes.BIGINT,
            allowNull: false,
        },
        warn_minutes: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        notification_type: {
            type: DataTypes.ENUM('dm', 'channel'),
            allowNull: false,
        },
        sent_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        tableName: 'arc_event_notifications',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['guild_id', 'user_id', 'event_start_time', 'warn_minutes'],
                name: 'arc_event_notif_unique',
            },
            {
                fields: ['sent_at'],
                name: 'arc_event_notif_sent_idx',
            },
        ],
    }),
});
