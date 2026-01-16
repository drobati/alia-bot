'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add skill check voting columns to dnd_games table
        await queryInterface.addColumn('dnd_games', 'pendingSkillCheck', {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn('dnd_games', 'skillCheckVotes', {
            type: Sequelize.JSON,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn('dnd_games', 'skillCheckMessageId', {
            type: Sequelize.STRING,
            allowNull: true,
            defaultValue: null,
        });

        await queryInterface.addColumn('dnd_games', 'skillCheckExpiresAt', {
            type: Sequelize.DATE,
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface, Sequelize) {
        await queryInterface.removeColumn('dnd_games', 'pendingSkillCheck');
        await queryInterface.removeColumn('dnd_games', 'skillCheckVotes');
        await queryInterface.removeColumn('dnd_games', 'skillCheckMessageId');
        await queryInterface.removeColumn('dnd_games', 'skillCheckExpiresAt');
    },
};
