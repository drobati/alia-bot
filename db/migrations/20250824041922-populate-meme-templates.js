'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    // Clean template data - matches fix-templates.js for consistency
    const templates = [
      {
        name: 'This Is Fine',
        url: 'https://i.imgflip.com/26hg.jpg',
        description: 'Dog sitting in burning room saying this is fine',
        text_positions: [], // Deprecated - now uses standardized positioning
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Ancient Aliens',
        url: 'https://i.imgflip.com/26am.jpg',
        description: 'Giorgio Tsoukalos saying aliens',
        text_positions: [], // Deprecated - now uses standardized positioning
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Surprised Pikachu',
        url: 'https://i.imgflip.com/2kbn1e.jpg',
        description: 'Pikachu with surprised expression',
        text_positions: [], // Deprecated - now uses standardized positioning
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Hide the Pain Harold',
        url: 'https://i.imgflip.com/gk5el.jpg',
        description: 'Harold hiding his pain with a forced smile',
        text_positions: [], // Deprecated - now uses standardized positioning
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Mocking SpongeBob',
        url: 'https://i.imgflip.com/1otk96.jpg',
        description: 'SpongeBob mocking someone with alternating caps',
        text_positions: [], // Deprecated - now uses standardized positioning
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Drake Pointing',
        url: 'https://i.imgflip.com/30b1gx.jpg',
        description: 'Drake pointing at things he likes/dislikes',
        text_positions: [], // Deprecated - now uses standardized positioning
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Distracted Boyfriend',
        url: 'https://i.imgflip.com/1ur9b0.jpg',
        description: 'Man looking at another woman while girlfriend looks on disapprovingly',
        text_positions: [], // Deprecated - now uses standardized positioning
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      }
    ];

    await queryInterface.bulkInsert('meme_templates', templates);
  },

  async down (queryInterface, Sequelize) {
    await queryInterface.bulkDelete('meme_templates', {
      creator: 'system'
    });
  }
};
