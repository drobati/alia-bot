import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    ArcWishlist: sequelize.define('ArcWishlist', {
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
        item_name: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        item_id: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        status: {
            type: DataTypes.ENUM('needed', 'found'),
            allowNull: false,
            defaultValue: 'needed',
        },
        notes: {
            type: DataTypes.STRING(500),
            allowNull: true,
        },
        found_at: {
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
        tableName: 'arc_wishlists',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['guild_id'],
                name: 'arc_wishlists_guild_idx',
            },
            {
                fields: ['guild_id', 'user_id'],
                name: 'arc_wishlists_guild_user_idx',
            },
            {
                fields: ['guild_id', 'status'],
                name: 'arc_wishlists_guild_status_idx',
            },
            {
                unique: true,
                fields: ['guild_id', 'user_id', 'item_name'],
                name: 'arc_wishlists_unique_item',
            },
        ],
    }),
});
