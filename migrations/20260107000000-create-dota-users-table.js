'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create dota_users table
        await queryInterface.createTable('dota_users', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            discord_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord user ID',
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord guild ID for guild-scoped leaderboards',
            },
            steam_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Steam 32-bit account ID for OpenDota API',
            },
            steam_username: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Cached Steam persona name',
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

        // Create unique index for discord_id + guild_id (one registration per user per guild)
        await queryInterface.addIndex('dota_users', ['discord_id', 'guild_id'], {
            unique: true,
            name: 'dota_users_discord_guild_unique',
        });

        // Create index for guild queries (leaderboard lookups)
        await queryInterface.addIndex('dota_users', ['guild_id'], {
            name: 'dota_users_guild_idx',
        });

        // Create index for steam_id lookups
        await queryInterface.addIndex('dota_users', ['steam_id'], {
            name: 'dota_users_steam_idx',
        });
    },

    async down(queryInterface) {
        // Drop indexes first
        await queryInterface.removeIndex('dota_users', 'dota_users_discord_guild_unique');
        await queryInterface.removeIndex('dota_users', 'dota_users_guild_idx');
        await queryInterface.removeIndex('dota_users', 'dota_users_steam_idx');

        // Drop table
        await queryInterface.dropTable('dota_users');
    },
};
