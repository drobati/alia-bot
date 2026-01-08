'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Check if column already exists (idempotent migration)
    const tableDescription = await queryInterface.describeTable('polls');
    if (tableDescription.poll_id) {
      console.log('Column "poll_id" already exists, skipping...');
      return;
    }

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
