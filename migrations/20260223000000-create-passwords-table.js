'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('passwords', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING(20),
                allowNull: false,
            },
            channel_id: {
                type: Sequelize.STRING(20),
                allowNull: false,
            },
            role_id: {
                type: Sequelize.STRING(20),
                allowNull: false,
            },
            password: {
                type: Sequelize.STRING(255),
                allowNull: false,
            },
            created_by: {
                type: Sequelize.STRING(20),
                allowNull: false,
            },
            active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
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

        await queryInterface.addIndex('passwords', ['guild_id', 'channel_id', 'active'], {
            name: 'passwords_guild_channel_active_idx',
        });
        await queryInterface.addIndex('passwords', ['guild_id', 'active'], {
            name: 'passwords_guild_active_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('passwords', 'passwords_guild_channel_active_idx');
        await queryInterface.removeIndex('passwords', 'passwords_guild_active_idx');
        await queryInterface.dropTable('passwords');
    },
};
