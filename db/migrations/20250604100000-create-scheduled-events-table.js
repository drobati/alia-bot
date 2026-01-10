'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create scheduled_events table
        await queryInterface.createTable('scheduled_events', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            event_id: {
                type: Sequelize.STRING(8),
                allowNull: false,
                unique: true,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            channel_id: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            creator_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            event_type: {
                type: Sequelize.ENUM('reminder', 'birthday', 'hype', 'tips'),
                allowNull: false,
            },
            payload: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            schedule_type: {
                type: Sequelize.ENUM('once', 'recurring', 'cron'),
                allowNull: false,
            },
            execute_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            cron_schedule: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            timezone: {
                type: Sequelize.STRING(50),
                allowNull: false,
                defaultValue: 'UTC',
            },
            status: {
                type: Sequelize.ENUM('pending', 'active', 'completed', 'cancelled', 'failed'),
                allowNull: false,
                defaultValue: 'active',
            },
            last_executed_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            next_execute_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            execution_count: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            max_executions: {
                type: Sequelize.INTEGER,
                allowNull: true,
            },
            metadata: {
                type: Sequelize.TEXT,
                allowNull: true,
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
        await queryInterface.addIndex('scheduled_events', ['status', 'next_execute_at'], {
            name: 'idx_status_next_execute',
        });

        await queryInterface.addIndex('scheduled_events', ['guild_id'], {
            name: 'idx_guild',
        });

        await queryInterface.addIndex('scheduled_events', ['creator_id', 'event_type'], {
            name: 'idx_creator_type',
        });

        await queryInterface.addIndex('scheduled_events', ['event_type'], {
            name: 'idx_type',
        });
    },

    async down(queryInterface) {
        // Drop indexes first
        await queryInterface.removeIndex('scheduled_events', 'idx_status_next_execute');
        await queryInterface.removeIndex('scheduled_events', 'idx_guild');
        await queryInterface.removeIndex('scheduled_events', 'idx_creator_type');
        await queryInterface.removeIndex('scheduled_events', 'idx_type');

        // Drop table
        await queryInterface.dropTable('scheduled_events');
    },
};
