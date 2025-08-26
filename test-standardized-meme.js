const { MemeGenerator } = require('./dist/src/utils/memeGenerator');

async function testStandardizedMemes() {
    console.log('Testing standardized meme generation...');
    
    const testCases = [
        {
            name: 'This Is Fine (Template)',
            template: {
                name: 'This Is Fine',
                url: 'https://i.imgflip.com/26am.jpg',
            },
            isTemplate: true,
            topText: 'Template generation',
            bottomText: 'Same sizing everywhere'
        },
        {
            name: 'Ancient Aliens (Template)', 
            template: {
                name: 'Ancient Aliens',
                url: 'https://i.imgflip.com/26hg.jpg',
            },
            isTemplate: true,
            topText: 'Template generation',
            bottomText: 'Same sizing everywhere'
        },
        {
            name: 'Custom URL (Same as This Is Fine)',
            url: 'https://i.imgflip.com/26am.jpg',
            isTemplate: false,
            topText: 'Custom URL generation',
            bottomText: 'Same sizing everywhere'
        },
        {
            name: 'Custom URL (Different image)',
            url: 'https://i.imgflip.com/2kbn1e.jpg',
            isTemplate: false,
            topText: 'Custom URL generation',
            bottomText: 'Same sizing everywhere'
        }
    ];
    
    for (const testCase of testCases) {
        try {
            console.log(`\\nTesting: ${testCase.name}`);
            
            let buffer;
            if (testCase.isTemplate) {
                buffer = await MemeGenerator.generateMeme(
                    testCase.template,
                    testCase.topText,
                    testCase.bottomText
                );
            } else {
                buffer = await MemeGenerator.generateCustomMeme(
                    testCase.url,
                    testCase.topText,
                    testCase.bottomText
                );
            }
            
            console.log(`✅ Success! Generated ${buffer.length} bytes`);
            
            // Save test image
            const fs = require('fs');
            const filename = `test_${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
            fs.writeFileSync(filename, buffer);
            console.log(`📁 Saved as ${filename}`);
            
        } catch (error) {
            console.error(`❌ Error for ${testCase.name}:`, error.message);
        }
    }
}

testStandardizedMemes();