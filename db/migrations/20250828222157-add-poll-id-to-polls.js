'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.addColumn('polls', 'poll_id', {
      type: Sequelize.STRING(8),
      allowNull: false,
      unique: true,
      defaultValue: '',
    });

    await queryInterface.addIndex('polls', ['poll_id'], {
      unique: true,
      name: 'polls_poll_id_unique'
    });
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.removeIndex('polls', 'polls_poll_id_unique');
    await queryInterface.removeColumn('polls', 'poll_id');
  }
};
