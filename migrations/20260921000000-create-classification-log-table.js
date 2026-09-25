'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('classification_logs', {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
            guild_id: { type: Sequelize.STRING, allowNull: false },
            channel_id: { type: Sequelize.STRING, allowNull: false },
            message_id: { type: Sequelize.STRING, allowNull: false },
            content: { type: Sequelize.STRING(255), allowNull: false },
            addressed: { type: Sequelize.BOOLEAN, allowNull: false },
            type: { type: Sequelize.STRING, allowNull: false },
            confidence: { type: Sequelize.FLOAT, allowNull: false },
            alternatives: { type: Sequelize.JSON, allowNull: true },
            route: { type: Sequelize.STRING, allowNull: false },
            reason: { type: Sequelize.STRING, allowNull: false },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });
        await queryInterface.addIndex('classification_logs', ['created_at']);
        await queryInterface.addIndex('classification_logs', ['type']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('classification_logs');
    },
};
