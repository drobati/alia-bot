import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    SecurityIncidents: sequelize.define('SecurityIncidents', {
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
        reason: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        content_hash: {
            type: DataTypes.STRING(64),
            allowNull: false,
        },
        channels_seen: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        roles_snapshot: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        action_taken: {
            type: DataTypes.STRING(64),
            allowNull: false,
            defaultValue: 'pending',
        },
        details: {
            type: DataTypes.TEXT,
            allowNull: true,
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
        tableName: 'security_incidents',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            { fields: ['guild_id', 'user_id'], name: 'security_incidents_guild_user_idx' },
            { fields: ['guild_id', 'created_at'], name: 'security_incidents_guild_time_idx' },
        ],
    }),
});
