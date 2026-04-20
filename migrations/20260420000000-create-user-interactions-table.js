'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('user_interactions', {
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
                comment: 'The Discord user who interacted with Alia',
            },
            interaction_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            last_interaction_at: {
                type: Sequelize.DATE,
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

        await queryInterface.addIndex('user_interactions', ['guild_id', 'user_id'], {
            unique: true,
            name: 'user_interactions_unique',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('user_interactions', 'user_interactions_unique');
        await queryInterface.dropTable('user_interactions');
    },
};
