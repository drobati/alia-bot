'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('motivational_configs', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      channel_id: {
        type: Sequelize.STRING,
        allowNull: false,
        unique: true,
      },
      guild_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      frequency: {
        type: Sequelize.ENUM('daily', 'weekly'),
        allowNull: false,
        defaultValue: 'daily',
      },
      category: {
        type: Sequelize.ENUM('motivation', 'productivity', 'general'),
        allowNull: false,
        defaultValue: 'motivation',
      },
      cron_schedule: {
        type: Sequelize.STRING,
        allowNull: false,
        defaultValue: '0 9 * * *', // 9 AM daily by default
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        defaultValue: true,
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
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('motivational_configs');
  }
};
