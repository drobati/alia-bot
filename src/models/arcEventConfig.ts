import { DataTypes } from 'sequelize';

export interface ArcEventConfigAttributes {
    id: number;
    guild_id: string;
    announcement_channel_id: string | null;
    allow_channel_announcements: boolean;
    allow_dm_notifications: boolean;
    created_at: Date;
    updated_at: Date;
}

export default (sequelize: any) => ({
    ArcEventConfig: sequelize.define('ArcEventConfig', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        announcement_channel_id: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Channel ID for event announcements',
        },
        allow_channel_announcements: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
        allow_dm_notifications: {
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
        tableName: 'arc_event_configs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['guild_id'],
                name: 'arc_event_configs_guild_unique',
            },
        ],
    }),
});
