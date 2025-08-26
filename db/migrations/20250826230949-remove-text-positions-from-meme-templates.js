'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.removeColumn('meme_templates', 'text_positions');
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.addColumn('meme_templates', 'text_positions', {
      type: Sequelize.JSON,
      allowNull: false,
      defaultValue: []
    });
  }
};
