#!/usr/bin/env node
// Test with exact training data matches

const path = require('path');

// Mock context object
const mockContext = {
    log: {
        info: (msg, data) => console.log('ℹ️  INFO:', msg, JSON.stringify(data, null, 2)),
        error: (msg, data) => console.log('❌ ERROR:', msg, JSON.stringify(data, null, 2)),
        warn: (msg, data) => console.log('⚠️  WARN:', msg, JSON.stringify(data, null, 2)),
        debug: (msg, data) => console.log('🐛 DEBUG:', msg, JSON.stringify(data, null, 2))
    }
};

process.env.ASSISTANT_DEBUG = 'true';
process.env.OPENAI_API_KEY = 'test-key';

// Mock Discord message
const createMockMessage = (content) => ({
    content,
    author: {
        bot: false,
        id: 'test-user-123',
        username: 'TestUser'
    },
    channelId: 'test-channel-123',
    channel: {
        send: async (response) => {
            console.log('📤 Discord Response:', response);
            return { id: 'mock-message-id' };
        }
    }
});

async function testExactMatches() {
    console.log('🧪 Testing with exact training data matches');
    
    // Load the assistant
    const assistantModule = require('../dist/src/responses/assistant.js');
    const assistant = assistantModule.default;

    // Test with exact matches from training data
    const exactMatches = [
        "What is the capital of France?",        // From training data
        "What is the tallest mountain in the world?", // From training data
        "Who wrote the novel '1984'?",          // From training data
        "Good morning!",                        // From training data (small-talk)
        "Hello, how are you?"                   // From training data (small-talk)
    ];

    for (const message of exactMatches) {
        console.log(`\n📝 Testing exact match: "${message}"`);
        console.log('---');
        
        const mockMessage = createMockMessage(message);
        
        try {
            await assistant(mockMessage, mockContext);
        } catch (error) {
            console.log('❌ Test failed:', error.message);
        }
        
        console.log('--- End of test ---');
    }
}

testExactMatches().catch(console.error);