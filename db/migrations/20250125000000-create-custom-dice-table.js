'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create custom_dice table
        await queryInterface.createTable('custom_dice', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },
            sides: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'JSON array of side values',
            },
            creator_id: {
                type: Sequelize.STRING,
                allowNull: false,
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

        // Create unique index for guild + name
        await queryInterface.addIndex('custom_dice', ['guild_id', 'name'], {
            unique: true,
            name: 'custom_dice_guild_name_unique',
        });

        // Create index for guild queries
        await queryInterface.addIndex('custom_dice', ['guild_id'], {
            name: 'custom_dice_guild_id_idx',
        });
    },

    async down(queryInterface) {
        // Drop indexes first
        await queryInterface.removeIndex('custom_dice', 'custom_dice_guild_name_unique');
        await queryInterface.removeIndex('custom_dice', 'custom_dice_guild_id_idx');

        // Drop table
        await queryInterface.dropTable('custom_dice');
    },
};
