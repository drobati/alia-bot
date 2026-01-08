import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    DotaUsers: sequelize.define('DotaUsers', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        discord_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Discord user ID',
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Discord guild ID for guild-scoped leaderboards',
        },
        steam_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Steam 32-bit account ID for OpenDota API',
        },
        steam_username: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Cached Steam persona name',
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
        tableName: 'dota_users',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['discord_id', 'guild_id'],
                name: 'dota_users_discord_guild_unique',
            },
            {
                fields: ['guild_id'],
                name: 'dota_users_guild_idx',
            },
            {
                fields: ['steam_id'],
                name: 'dota_users_steam_idx',
            },
        ],
    }),
});
