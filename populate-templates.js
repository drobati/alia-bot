// Quick script to populate meme templates if they don't exist
const templates = [
    {
        name: 'This Is Fine',
        url: 'https://i.imgflip.com/26am.jpg', // Correct: This is the dog in fire
        description: 'Dog sitting in burning room saying this is fine'
    },
    {
        name: 'Ancient Aliens',
        url: 'https://i.imgflip.com/26hg.jpg', // Correct: This is Giorgio Tsoukalos
        description: 'Giorgio Tsoukalos saying aliens'
    },
    {
        name: 'Surprised Pikachu',
        url: 'https://i.imgflip.com/2kbn1e.jpg', // Correct: This is Pikachu
        description: 'Pikachu with surprised expression'
    },
    {
        name: 'Hide the Pain Harold',
        url: 'https://i.imgflip.com/gk5el.jpg', // Correct: This is Harold
        description: 'Harold hiding his pain with a forced smile'
    },
    {
        name: 'Mocking SpongeBob',
        url: 'https://i.imgflip.com/1otk96.jpg', // Correct: This is SpongeBob
        description: 'SpongeBob mocking someone with alternating caps'
    },
    {
        name: 'Drake Pointing',
        url: 'https://i.imgflip.com/30b1gx.jpg', // Correct: This is Drake
        description: 'Drake pointing at things he likes/dislikes'
    },
    {
        name: 'Distracted Boyfriend',
        url: 'https://i.imgflip.com/1ur9b0.jpg', // Correct: This is distracted boyfriend
        description: 'Man looking at another woman while girlfriend looks on disapprovingly'
    }
];

// Function to be called from the main bot initialization
async function ensureTemplatesExist(context) {
    try {
        console.log('Checking if meme templates exist...');
        
        const existingCount = await context.tables.MemeTemplate.count({
            where: { is_active: true }
        });
        
        if (existingCount === 0) {
            console.log('No templates found, creating default templates...');
            
            for (const template of templates) {
                await context.tables.MemeTemplate.create({
                    name: template.name,
                    url: template.url,
                    description: template.description,
                    default_font_size: 32,
                    creator: 'system',
                    usage_count: 0,
                    is_active: true
                });
            }
            
            console.log(`Created ${templates.length} default meme templates`);
        } else {
            console.log(`Found ${existingCount} existing templates`);
        }
    } catch (error) {
        console.error('Error ensuring templates exist:', error);
    }
}

module.exports = { ensureTemplatesExist };