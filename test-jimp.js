const { Jimp, loadFont } = require('jimp');
const path = require('path');

async function testJimp() {
    console.log('Testing Jimp functionality...');
    
    try {
        // Create a simple test image using constructor
        console.log('Creating basic test image...');
        const canvas = new Jimp({ width: 300, height: 200 });
        console.log('✓ Image creation works, dimensions:', canvas.width, 'x', canvas.height);
        
        // Test font loading with available fonts
        console.log('Testing font loading...');
        const fontPath = path.join(__dirname, 'node_modules/@jimp/plugin-print/dist/fonts/open-sans/open-sans-16-black/open-sans-16-black.fnt');
        const font = await loadFont(fontPath);
        console.log('✓ Font loads successfully');
        
        // Test text printing  
        console.log('Testing text printing...');
        canvas.print({
            font: font,
            x: 10,
            y: 10,
            text: 'Hello Meme!'
        });
        console.log('✓ Text printing works');
        
        // Test buffer output
        const buffer = await canvas.getBuffer('image/png');
        console.log('✓ Buffer output works, size:', buffer.length, 'bytes');
        
        console.log('\nAll essential Jimp functions are working!');
        
    } catch (error) {
        console.error('All Jimp tests failed:', error);
    }
}

testJimp();