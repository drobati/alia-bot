const { MemeGenerator } = require('./dist/src/utils/memeGenerator');

async function testSimpleMeme() {
    console.log('Testing simplified meme generation...');
    
    // Test with a simple template structure
    const mockTemplate = {
        name: 'This Is Fine Test',
        url: 'https://i.imgflip.com/26am.jpg',
        description: 'Dog sitting in burning room saying this is fine'
    };
    
    try {
        console.log('Generating meme with top and bottom text...');
        const buffer = await MemeGenerator.generateMeme(
            mockTemplate,
            'When everything is breaking',
            'But the tests pass'
        );
        
        console.log(`Success! Generated meme buffer of ${buffer.length} bytes`);
        
        // Save test image
        const fs = require('fs');
        fs.writeFileSync('test_simple_meme_32px.png', buffer);
        console.log('Saved test image as test_simple_meme_32px.png');
        
    } catch (error) {
        console.error('Error generating meme:', error.message);
    }
}

testSimpleMeme();