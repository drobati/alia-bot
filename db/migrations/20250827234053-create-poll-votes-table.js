'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('poll_votes', {
      id: {
        type: Sequelize.INTEGER,
        primaryKey: true,
        autoIncrement: true,
        allowNull: false,
      },
      poll_id: {
        type: Sequelize.INTEGER,
        allowNull: false,
        references: {
          model: 'polls',
          key: 'id',
        },
        onDelete: 'CASCADE',
      },
      user_id: {
        type: Sequelize.STRING,
        allowNull: false,
      },
      option_index: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      voted_at: {
        type: Sequelize.DATE,
        allowNull: false,
        defaultValue: Sequelize.fn('NOW'),
      },
    });

    await queryInterface.addIndex('poll_votes', ['poll_id', 'user_id'], {
      unique: true,
      name: 'poll_votes_poll_user_unique',
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('poll_votes');
  }
};
