// Script to fix template URLs and ensure all templates exist
const correctTemplates = [
    {
        name: 'This Is Fine',
        url: 'https://i.imgflip.com/26am.jpg', // Correct: Dog in burning room
        description: 'Dog sitting in burning room saying this is fine'
    },
    {
        name: 'Ancient Aliens',
        url: 'https://i.imgflip.com/26hg.jpg', // Correct: Giorgio Tsoukalos (was swapped)
        description: 'Giorgio Tsoukalos saying aliens'
    },
    {
        name: 'Surprised Pikachu',
        url: 'https://i.imgflip.com/2kbn1e.jpg', // Pikachu
        description: 'Pikachu with surprised expression'
    },
    {
        name: 'Hide the Pain Harold',
        url: 'https://i.imgflip.com/gk5el.jpg', // Harold
        description: 'Harold hiding his pain with a forced smile'
    },
    {
        name: 'Mocking SpongeBob',
        url: 'https://i.imgflip.com/1otk96.jpg', // SpongeBob
        description: 'SpongeBob mocking someone with alternating caps'
    },
    {
        name: 'Drake Pointing',
        url: 'https://i.imgflip.com/30b1gx.jpg', // Drake
        description: 'Drake pointing at things he likes/dislikes'
    },
    {
        name: 'Distracted Boyfriend',
        url: 'https://i.imgflip.com/1ur9b0.jpg', // Distracted boyfriend
        description: 'Man looking at another woman while girlfriend looks on disapprovingly'
    }
];

async function fixTemplates(context) {
    try {
        console.log('Clearing existing templates...');
        await context.tables.MemeTemplate.destroy({
            where: { creator: 'system' }
        });
        
        console.log('Adding corrected templates...');
        for (const template of correctTemplates) {
            await context.tables.MemeTemplate.create({
                name: template.name,
                url: template.url,
                description: template.description,
                default_font_size: 32,
                creator: 'system',
                usage_count: 0,
                is_active: true
            });
            console.log(`✓ Added: ${template.name}`);
        }
        
        console.log(`Fixed ${correctTemplates.length} templates with correct URLs`);
        
        // List all templates to verify
        const allTemplates = await context.tables.MemeTemplate.findAll({
            where: { is_active: true },
            order: [['name', 'ASC']]
        });
        
        console.log('\nCurrent templates:');
        allTemplates.forEach(template => {
            console.log(`- ${template.name}: ${template.url}`);
        });
        
    } catch (error) {
        console.error('Error fixing templates:', error);
    }
}

module.exports = { fixTemplates };