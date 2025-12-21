'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('verification_codes', {
      code: {
        type: Sequelize.STRING(8),
        primaryKey: true,
        allowNull: false,
      },
      guild_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      generator_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      role_id: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      used: {
        type: Sequelize.BOOLEAN,
        defaultValue: false,
        allowNull: false,
      },
      used_by: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      used_at: {
        type: Sequelize.DATE,
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

    // Index for efficient active code queries (guild + used + created_at)
    await queryInterface.addIndex('verification_codes', ['guild_id', 'used', 'created_at']);
    // Index for counting user's active codes
    await queryInterface.addIndex('verification_codes', ['generator_id', 'used', 'created_at']);
    // Index for looking up code by guild
    await queryInterface.addIndex('verification_codes', ['guild_id']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('verification_codes');
  }
};
