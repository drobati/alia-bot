'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create user_descriptions table
        await queryInterface.createTable('user_descriptions', {
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
            user_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'The user being described',
            },
            description: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            creator_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'The user who added this description',
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

        // Create unique index for guild + user + description
        await queryInterface.addIndex('user_descriptions', ['guild_id', 'user_id', 'description'], {
            unique: true,
            name: 'user_descriptions_unique',
        });

        // Create index for guild + user queries
        await queryInterface.addIndex('user_descriptions', ['guild_id', 'user_id'], {
            name: 'user_descriptions_guild_user_idx',
        });
    },

    async down(queryInterface) {
        // Drop indexes first
        await queryInterface.removeIndex('user_descriptions', 'user_descriptions_unique');
        await queryInterface.removeIndex('user_descriptions', 'user_descriptions_guild_user_idx');

        // Drop table
        await queryInterface.dropTable('user_descriptions');
    },
};
