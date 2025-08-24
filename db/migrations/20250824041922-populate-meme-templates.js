'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up (queryInterface, Sequelize) {
    const templates = [
      {
        name: 'Drake Pointing',
        url: 'https://i.imgflip.com/30b1gx.jpg',
        description: 'Drake pointing at things he likes/dislikes',
        text_positions: [
          { x: 400, y: 100, align: 'left', baseline: 'middle' },
          { x: 400, y: 300, align: 'left', baseline: 'middle' }
        ],
        default_font_size: 30,
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
        text_positions: [
          { x: 150, y: 350, align: 'center', baseline: 'bottom' },
          { x: 400, y: 350, align: 'center', baseline: 'bottom' },
          { x: 600, y: 350, align: 'center', baseline: 'bottom' }
        ],
        default_font_size: 24,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Expanding Brain',
        url: 'https://i.imgflip.com/1jwhww.jpg',
        description: 'Four-panel brain expansion meme',
        text_positions: [
          { x: 400, y: 90, align: 'center', baseline: 'middle' },
          { x: 400, y: 200, align: 'center', baseline: 'middle' },
          { x: 400, y: 310, align: 'center', baseline: 'middle' },
          { x: 400, y: 420, align: 'center', baseline: 'middle' }
        ],
        default_font_size: 28,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Two Buttons',
        url: 'https://i.imgflip.com/1g8my4.jpg',
        description: 'Person sweating over two button choices',
        text_positions: [
          { x: 150, y: 100, align: 'center', baseline: 'middle' },
          { x: 350, y: 100, align: 'center', baseline: 'middle' }
        ],
        default_font_size: 20,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Change My Mind',
        url: 'https://i.imgflip.com/24y43o.jpg',
        description: 'Steven Crowder sitting at a table with a sign',
        text_positions: [
          { x: 350, y: 300, align: 'center', baseline: 'middle' }
        ],
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Left Exit 12 Off Ramp',
        url: 'https://i.imgflip.com/22bdq6.jpg',
        description: 'Car exiting highway representing choices',
        text_positions: [
          { x: 200, y: 50, align: 'center', baseline: 'middle' },
          { x: 400, y: 150, align: 'center', baseline: 'middle' },
          { x: 150, y: 250, align: 'center', baseline: 'middle' }
        ],
        default_font_size: 24,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Woman Yelling at Cat',
        url: 'https://i.imgflip.com/345v97.jpg',
        description: 'Woman pointing and yelling with confused cat at dinner table',
        text_positions: [
          { x: 200, y: 50, align: 'center', baseline: 'top' },
          { x: 500, y: 50, align: 'center', baseline: 'top' }
        ],
        default_font_size: 30,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'This Is Fine',
        url: 'https://i.imgflip.com/26am.jpg',
        description: 'Dog sitting in burning room saying this is fine',
        text_positions: [
          { x: 300, y: 50, align: 'center', baseline: 'top' },
          { x: 300, y: 350, align: 'center', baseline: 'bottom' }
        ],
        default_font_size: 30,
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
        text_positions: [
          { x: 300, y: 50, align: 'center', baseline: 'top' },
          { x: 300, y: 350, align: 'center', baseline: 'bottom' }
        ],
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
        text_positions: [
          { x: 300, y: 50, align: 'center', baseline: 'top' },
          { x: 300, y: 350, align: 'center', baseline: 'bottom' }
        ],
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Ancient Aliens',
        url: 'https://i.imgflip.com/26hg.jpg',
        description: 'Giorgio Tsoukalos saying aliens',
        text_positions: [
          { x: 300, y: 50, align: 'center', baseline: 'top' },
          { x: 300, y: 350, align: 'center', baseline: 'bottom' }
        ],
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
        text_positions: [
          { x: 300, y: 50, align: 'center', baseline: 'top' },
          { x: 300, y: 350, align: 'center', baseline: 'bottom' }
        ],
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Batman Slapping Robin',
        url: 'https://i.imgflip.com/9ehk.jpg',
        description: 'Batman slapping Robin mid-sentence',
        text_positions: [
          { x: 200, y: 100, align: 'center', baseline: 'middle' },
          { x: 400, y: 250, align: 'center', baseline: 'middle' }
        ],
        default_font_size: 28,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'One Does Not Simply',
        url: 'https://i.imgflip.com/1bij.jpg',
        description: 'Boromir from LOTR explaining something is not simple',
        text_positions: [
          { x: 300, y: 50, align: 'center', baseline: 'top' },
          { x: 300, y: 350, align: 'center', baseline: 'bottom' }
        ],
        default_font_size: 32,
        creator: 'system',
        usage_count: 0,
        is_active: true,
        createdAt: new Date(),
        updatedAt: new Date()
      },
      {
        name: 'Grumpy Cat',
        url: 'https://i.imgflip.com/30b1gx.jpg',
        description: 'Grumpy cat with disapproving expression',
        text_positions: [
          { x: 300, y: 50, align: 'center', baseline: 'top' },
          { x: 300, y: 350, align: 'center', baseline: 'bottom' }
        ],
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
