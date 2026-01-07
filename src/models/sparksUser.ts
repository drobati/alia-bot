import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    SparksUser: sequelize.define('SparksUser', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        discord_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        hide_last_seen: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
        },
        last_seen_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        last_seen_channel_id: {
            type: DataTypes.STRING,
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
        tableName: 'sparks_users',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['guild_id', 'discord_id'],
                name: 'sparks_users_guild_discord_unique',
            },
        ],
    }),
});
