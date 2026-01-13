'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('arc_wishlists', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord guild ID for server-scoped wishlists',
            },
            user_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord user ID',
            },
            username: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Cached Discord username for display',
            },
            item_name: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Item name from MetaForge API',
            },
            item_id: {
                type: Sequelize.STRING(100),
                allowNull: true,
                comment: 'MetaForge API item ID for linking',
            },
            status: {
                type: Sequelize.ENUM('needed', 'found'),
                allowNull: false,
                defaultValue: 'needed',
            },
            notes: {
                type: Sequelize.STRING(500),
                allowNull: true,
                comment: 'User notes about the item',
            },
            found_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Timestamp when item was marked found',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Create indexes
        await queryInterface.addIndex('arc_wishlists', ['guild_id'], {
            name: 'arc_wishlists_guild_idx',
        });
        await queryInterface.addIndex('arc_wishlists', ['guild_id', 'user_id'], {
            name: 'arc_wishlists_guild_user_idx',
        });
        await queryInterface.addIndex('arc_wishlists', ['guild_id', 'status'], {
            name: 'arc_wishlists_guild_status_idx',
        });
        await queryInterface.addIndex('arc_wishlists', ['guild_id', 'user_id', 'item_name'], {
            unique: true,
            name: 'arc_wishlists_unique_item',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('arc_wishlists', 'arc_wishlists_guild_idx');
        await queryInterface.removeIndex('arc_wishlists', 'arc_wishlists_guild_user_idx');
        await queryInterface.removeIndex('arc_wishlists', 'arc_wishlists_guild_status_idx');
        await queryInterface.removeIndex('arc_wishlists', 'arc_wishlists_unique_item');
        await queryInterface.dropTable('arc_wishlists');
    },
};
