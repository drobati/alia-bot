'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create spice_balances table
        await queryInterface.createTable('spice_balances', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord guild ID for server-scoped balances',
            },
            discord_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord user ID',
            },
            username: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Cached Discord username for display',
            },
            current_balance: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            last_harvest_at: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'Last time user harvested spice',
            },
            lifetime_harvested: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            lifetime_given: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
                comment: 'Total spice given to others',
            },
            lifetime_received: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
                comment: 'Total spice received from others',
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

        // Create indexes for spice_balances
        await queryInterface.addIndex('spice_balances', ['guild_id', 'discord_id'], {
            unique: true,
            name: 'spice_balances_guild_user_unique',
        });
        await queryInterface.addIndex('spice_balances', ['guild_id', 'current_balance'], {
            name: 'spice_balances_guild_balance_idx',
        });

        // Create spice_ledger table
        await queryInterface.createTable('spice_ledger', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord guild ID',
            },
            discord_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord user ID',
            },
            type: {
                type: Sequelize.ENUM('harvest', 'give_sent', 'give_received'),
                allowNull: false,
            },
            amount: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            target_discord_id: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'For give transactions, the other party Discord ID',
            },
            description: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
                defaultValue: Sequelize.literal('CURRENT_TIMESTAMP'),
            },
        });

        // Create indexes for spice_ledger
        await queryInterface.addIndex('spice_ledger', ['guild_id', 'discord_id', 'created_at'], {
            name: 'spice_ledger_user_created_idx',
        });
        await queryInterface.addIndex('spice_ledger', ['guild_id', 'type'], {
            name: 'spice_ledger_guild_type_idx',
        });
    },

    async down(queryInterface) {
        // Remove indexes
        await queryInterface.removeIndex('spice_balances', 'spice_balances_guild_user_unique');
        await queryInterface.removeIndex('spice_balances', 'spice_balances_guild_balance_idx');
        await queryInterface.removeIndex('spice_ledger', 'spice_ledger_user_created_idx');
        await queryInterface.removeIndex('spice_ledger', 'spice_ledger_guild_type_idx');

        // Drop tables
        await queryInterface.dropTable('spice_ledger');
        await queryInterface.dropTable('spice_balances');
    },
};
