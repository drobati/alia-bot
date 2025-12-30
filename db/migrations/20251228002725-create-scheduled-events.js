'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
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
        allowNull: true, // Nullable for DM reminders
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
        allowNull: true, // For one-time events
      },
      cron_schedule: {
        type: Sequelize.STRING,
        allowNull: true, // For recurring events
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
        allowNull: true, // null = unlimited
      },
      metadata: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      created_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
      updated_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    // Add indexes for efficient querying
    await queryInterface.addIndex('scheduled_events', ['status', 'next_execute_at'], {
      name: 'idx_scheduled_events_status_next',
    });
    await queryInterface.addIndex('scheduled_events', ['guild_id'], {
      name: 'idx_scheduled_events_guild',
    });
    await queryInterface.addIndex('scheduled_events', ['creator_id', 'event_type'], {
      name: 'idx_scheduled_events_creator_type',
    });
    await queryInterface.addIndex('scheduled_events', ['event_type'], {
      name: 'idx_scheduled_events_type',
    });
  },

  async down(queryInterface) {
    await queryInterface.dropTable('scheduled_events');
  },
};
