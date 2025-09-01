#!/usr/bin/env node

/**
 * Force refresh Discord slash commands by clearing and re-deploying
 * This helps when Discord's cache is stale
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465';
const GUILD_ID = process.env.GUILD_ID || '772638687854231563'; // Arrakis Discord guild

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment variables');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, '..', 'dist', 'src', 'commands');

// Load all command files
const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && !file.includes('.test.'));

for (const file of commandFiles) {
    const filePath = path.join(commandsPath, file);
    try {
        const command = require(filePath);
        
        if (command.default && command.default.data) {
            const commandData = command.default.data.toJSON ? 
                command.default.data.toJSON() : 
                command.default.data;
                
            commands.push(commandData);
            console.log(`✅ Loaded command: ${commandData.name}`);
            
            // Special logging for speak command
            if (commandData.name === 'speak') {
                console.log('📢 Speak command options:');
                commandData.options.forEach(opt => {
                    console.log(`   - ${opt.name}: ${opt.description} ${opt.required ? '(required)' : '(optional)'}`);
                });
            }
        }
    } catch (error) {
        console.error(`❌ Error loading ${file}:`, error.message);
    }
}

console.log(`\n📦 Loaded ${commands.length} commands`);

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('\n🧹 Clearing existing commands...');
        
        // Clear global commands
        await rest.put(Routes.applicationCommands(CLIENT_ID), { body: [] });
        console.log('✅ Cleared global commands');
        
        // Skip guild clearing - we already handled this separately
        
        // Wait a moment for Discord to process
        console.log('⏳ Waiting for Discord to clear cache...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n🚀 Re-deploying commands...');
        
        // Deploy globally
        const globalData = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );
        
        console.log(`✅ Deployed ${globalData.length} commands globally!`);
        
        // Skip guild deployment - deploy globally only to avoid overrides
        
        // Verify speak command
        console.log('\n🔍 Verifying /speak command structure:');
        const deployedSpeak = globalData.find(cmd => cmd.name === 'speak');
        if (deployedSpeak) {
            console.log('✅ /speak command found with options:');
            deployedSpeak.options.forEach(opt => {
                console.log(`   - ${opt.name}: ${opt.description}`);
            });
            
            if (!deployedSpeak.options.find(opt => opt.name === 'tone')) {
                console.error('⚠️ WARNING: tone option is missing from deployed command!');
            } else {
                console.log('✅ tone option is present!');
            }
        }
        
        console.log('\n✨ Command refresh complete!');
        console.log('📝 Note: It may take a few minutes for Discord to update the command interface.');
        console.log('💡 Try refreshing Discord (Ctrl+R or Cmd+R) if commands don\'t appear immediately.');
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
})();