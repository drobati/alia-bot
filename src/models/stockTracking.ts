import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    StockTracking: sequelize.define('StockTracking', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        channel_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        ticker: {
            type: DataTypes.STRING(10),
            allowNull: false,
        },
        feature: {
            type: DataTypes.ENUM('market_open', 'market_close', 'big_swing'),
            allowNull: false,
        },
        threshold: {
            type: DataTypes.FLOAT,
            allowNull: true,
            defaultValue: null,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
        },
        last_notified_at: {
            type: DataTypes.DATE,
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
        tableName: 'stock_tracking',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['guild_id', 'channel_id', 'ticker', 'feature'],
                name: 'stock_tracking_guild_channel_ticker_feature',
            },
            {
                fields: ['is_active'],
                name: 'stock_tracking_active',
            },
        ],
    }),
});
