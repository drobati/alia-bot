'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create dnd_games table
        await queryInterface.createTable('dnd_games', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guildId: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            name: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            systemPrompt: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            conversationHistory: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: [],
            },
            channelId: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            isActive: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            waitPeriodMinutes: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 5,
            },
            currentRound: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            pendingMessages: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: [],
            },
            lastResponseTime: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Create indexes
        await queryInterface.addIndex('dnd_games', ['guildId'], {
            name: 'dnd_games_guild_id_idx',
        });

        await queryInterface.addIndex('dnd_games', ['guildId', 'name'], {
            unique: true,
            name: 'dnd_games_guild_name_unique',
        });

        await queryInterface.addIndex('dnd_games', ['guildId', 'isActive'], {
            name: 'dnd_games_guild_active_idx',
        });

        await queryInterface.addIndex('dnd_games', ['channelId'], {
            name: 'dnd_games_channel_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        // Drop indexes first
        await queryInterface.removeIndex('dnd_games', 'dnd_games_guild_id_idx');
        await queryInterface.removeIndex('dnd_games', 'dnd_games_guild_name_unique');
        await queryInterface.removeIndex('dnd_games', 'dnd_games_guild_active_idx');
        await queryInterface.removeIndex('dnd_games', 'dnd_games_channel_id_idx');

        // Drop table
        await queryInterface.dropTable('dnd_games');
    },
};
