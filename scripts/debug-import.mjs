#!/usr/bin/env node

console.log('🔍 Debugging assistant import...');

try {
    const assistantModule = await import('../dist/src/responses/assistant.js');
    console.log('📦 Module imported successfully');
    console.log('📋 Module keys:', Object.keys(assistantModule));
    console.log('📋 Default export type:', typeof assistantModule.default);
    console.log('📋 Default export:', assistantModule.default);
    
    if (typeof assistantModule.default === 'function') {
        console.log('✅ Default export is a function');
    } else {
        console.log('❌ Default export is not a function');
    }
} catch (error) {
    console.error('❌ Import failed:', error);
}