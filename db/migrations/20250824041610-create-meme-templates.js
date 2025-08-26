'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    await queryInterface.createTable('meme_templates', {
      id: {
        allowNull: false,
        autoIncrement: true,
        primaryKey: true,
        type: Sequelize.INTEGER
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
        unique: true
      },
      url: {
        type: Sequelize.TEXT,
        allowNull: false
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true
      },
      default_font_size: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 40
      },
      creator: {
        type: Sequelize.STRING(100),
        allowNull: true
      },
      usage_count: {
        type: Sequelize.INTEGER,
        allowNull: false,
        defaultValue: 0
      },
      is_active: {
        type: Sequelize.BOOLEAN,
        allowNull: false,
        defaultValue: true
      },
      createdAt: {
        allowNull: false,
        type: Sequelize.DATE
      },
      updatedAt: {
        allowNull: false,
        type: Sequelize.DATE
      }
    });

    await queryInterface.addIndex('meme_templates', ['name']);
    await queryInterface.addIndex('meme_templates', ['is_active']);
    await queryInterface.addIndex('meme_templates', ['usage_count']);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.dropTable('meme_templates');
  }
};
