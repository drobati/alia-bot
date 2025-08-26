const { MemeGenerator } = require('./dist/src/utils/memeGenerator');

async function testFinalSizing() {
    console.log('Testing final meme generation with proportional sizing...');
    
    const testCases = [
        {
            name: 'This Is Fine (Template)',
            template: {
                name: 'This Is Fine',
                url: 'https://i.imgflip.com/26am.jpg', // 500x436
            },
            isTemplate: true,
            topText: 'Template with correct image',
            bottomText: 'Should be dog in fire'
        },
        {
            name: 'Ancient Aliens (Template)', 
            template: {
                name: 'Ancient Aliens',
                url: 'https://i.imgflip.com/26hg.jpg', // 500x323
            },
            isTemplate: true,
            topText: 'Template with correct image',
            bottomText: 'Should be Giorgio saying aliens'
        },
        {
            name: 'Custom URL - Same as This Is Fine',
            url: 'https://i.imgflip.com/26am.jpg', // 500x436 - same size as template
            isTemplate: false,
            topText: 'Custom URL same size',
            bottomText: 'Should match template exactly'
        },
        {
            name: 'Custom URL - Large Pikachu',
            url: 'https://i.imgflip.com/2kbn1e.jpg', // 1893x1892 - much larger
            isTemplate: false,
            topText: 'Large image proportional sizing',
            bottomText: 'Text should be readable'
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
            const filename = `final_test_${testCase.name.toLowerCase().replace(/[^a-z0-9]/g, '_')}.png`;
            fs.writeFileSync(filename, buffer);
            console.log(`📁 Saved as ${filename}`);
            
        } catch (error) {
            console.error(`❌ Error for ${testCase.name}:`, error.message);
        }
    }
}

testFinalSizing();