#!/usr/bin/env node
// Simple script to test assistant logging improvements locally

const path = require('path');
const fs = require('fs');

// Mock Discord message object
const createMockMessage = (content, userId = 'test-user-123', username = 'TestUser') => ({
    content,
    author: {
        bot: false,
        id: userId,
        username
    },
    channelId: 'test-channel-123',
    channel: {
        send: async (response) => {
            console.log('📤 Discord Response:', response);
            return { id: 'mock-message-id' };
        }
    }
});

// Mock context object
const mockContext = {
    log: {
        info: (msg, data) => console.log('ℹ️  INFO:', msg, JSON.stringify(data, null, 2)),
        error: (msg, data) => console.log('❌ ERROR:', msg, JSON.stringify(data, null, 2)),
        warn: (msg, data) => console.log('⚠️  WARN:', msg, JSON.stringify(data, null, 2)),
        debug: (msg, data) => console.log('🐛 DEBUG:', msg, JSON.stringify(data, null, 2))
    }
};

// Set environment variables for testing
process.env.ASSISTANT_DEBUG = 'true';
process.env.OPENAI_API_KEY = 'test-key-will-fail'; // This will cause API errors for testing

console.log('🧪 Testing Assistant Logging Improvements');
console.log('Environment:', {
    ASSISTANT_DEBUG: process.env.ASSISTANT_DEBUG,
    OPENAI_API_KEY: process.env.OPENAI_API_KEY ? 'SET' : 'NOT_SET'
});
console.log();

async function testAssistant() {
    try {
        // Import the assistant (this will trigger classifier training logs)
        console.log('📥 Loading assistant module...');
        const assistantModule = require('../dist/src/responses/assistant.js');
        const assistant = assistantModule.default;

        console.log('✅ Assistant module loaded\n');

        // Test cases
        const testCases = [
            {
                name: 'General Knowledge Question',
                message: 'What is the capital of France?',
                expectedIntent: 'general-knowledge',
                expectedHighConfidence: true
            },
            {
                name: 'Technical Question', 
                message: 'How do I declare a variable in JavaScript?',
                expectedIntent: 'technical-question',
                expectedHighConfidence: true
            },
            {
                name: 'Random Chat',
                message: 'Hey there, nice weather today!',
                expectedIntent: 'small-talk',
                expectedHighConfidence: false
            },
            {
                name: 'Command Request',
                message: 'Write a Python function to calculate factorial',
                expectedIntent: 'command',
                expectedHighConfidence: true
            }
        ];

        for (const testCase of testCases) {
            console.log(`\n🧪 Testing: ${testCase.name}`);
            console.log(`📝 Message: "${testCase.message}"`);
            console.log('---');

            const mockMessage = createMockMessage(testCase.message);
            
            try {
                await assistant(mockMessage, mockContext);
            } catch (error) {
                console.log('❌ Test failed:', error.message);
            }
            
            console.log('--- End of test ---\n');
        }

    } catch (error) {
        console.error('Failed to load assistant:', error);
        console.log('\n💡 Make sure to run "npm run build" first to compile TypeScript files.');
    }
}

// Check if compiled files exist
const distPath = path.join(__dirname, '../dist/src/responses/assistant.js');
if (!fs.existsSync(distPath)) {
    console.log('❌ Compiled files not found. Please run "npm run build" first.');
    process.exit(1);
}

testAssistant().catch(console.error);