import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    SpiceBalance: sequelize.define('SpiceBalance', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Discord guild ID for server-scoped balances',
        },
        discord_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Discord user ID',
        },
        username: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'Cached Discord username for display',
        },
        current_balance: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        last_harvest_at: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'Last time user harvested spice',
        },
        lifetime_harvested: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        lifetime_given: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Total spice given to others',
        },
        lifetime_received: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Total spice received from others',
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
        tableName: 'spice_balances',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['guild_id', 'discord_id'],
                name: 'spice_balances_guild_user_unique',
            },
            {
                fields: ['guild_id', 'current_balance'],
                name: 'spice_balances_guild_balance_idx',
            },
        ],
    }),
});
