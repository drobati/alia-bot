#!/usr/bin/env tsx
// Simple script to test assistant logging improvements locally

import path from 'path';
import fs from 'fs';
import assistant from '../src/responses/assistant';
import { Message } from 'discord.js';
import { Context } from '../src/utils/types';

// Mock Discord message object
const createMockMessage = (content: string, userId = 'test-user-123', username = 'TestUser'): Partial<Message> => ({
    content,
    author: {
        bot: false,
        id: userId,
        username,
        discriminator: '0000',
        avatar: null,
        system: false,
        createdTimestamp: Date.now(),
        defaultAvatarURL: 'https://discord.com/assets/default.png',
        tag: `${username}#0000`,
        createdAt: new Date(),
        avatarURL: () => null,
        displayAvatarURL: () => 'https://discord.com/assets/default.png',
        toString: () => `<@${userId}>`
    } as any,
    channelId: 'test-channel-123',
    channel: {
        send: async (response: any) => {
            console.log('📤 Discord Response:', response);
            return { id: 'mock-message-id' } as any;
        }
    } as any
});

// Mock context object
const mockContext: Context = {
    log: {
        info: (msg: string, data?: any) => console.log('ℹ️  INFO:', msg, JSON.stringify(data, null, 2)),
        error: (msg: string, data?: any) => console.log('❌ ERROR:', msg, JSON.stringify(data, null, 2)),
        warn: (msg: string, data?: any) => console.log('⚠️  WARN:', msg, JSON.stringify(data, null, 2)),
        debug: (msg: string, data?: any) => console.log('🐛 DEBUG:', msg, JSON.stringify(data, null, 2))
    },
    tables: {} as any,
    sequelize: {} as any,
    VERSION: 'test-version'
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
        console.log('📥 Assistant module loaded (imported directly)\n');

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
                await assistant(mockMessage as Message, mockContext);
            } catch (error: any) {
                console.log('❌ Test failed:', error.message);
            }
            
            console.log('--- End of test ---\n');
        }

    } catch (error) {
        console.error('Failed to test assistant:', error);
    }
}

testAssistant().catch(console.error);