#!/usr/bin/env node

/**
 * Deploy Discord slash commands to Discord servers
 * This script registers/updates all slash commands with Discord
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465'; // Alia bot's client ID

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
            // Skip development-only commands in production
            if (command.default.developmentOnly && process.env.NODE_ENV === 'production') {
                console.log(`⏭️ Skipping development-only command: ${command.default.data.name}`);
                continue;
            }
            
            // Convert SlashCommandBuilder to JSON
            const commandData = command.default.data.toJSON ? 
                command.default.data.toJSON() : 
                command.default.data;
                
            commands.push(commandData);
            console.log(`✅ Loaded command: ${commandData.name}`);
            
            // Show command options for debugging
            if (commandData.options && commandData.options.length > 0) {
                console.log(`   Options: ${commandData.options.map(opt => opt.name).join(', ')}`);
            }
        } else {
            console.warn(`⚠️ Skipping ${file} - missing data property`);
        }
    } catch (error) {
        // Skip commands that fail to load due to import issues but continue processing others
        console.warn(`⚠️ Skipping ${file} due to import error: ${error.message}`);
        continue;
    }
}

console.log(`\n📦 Loaded ${commands.length} commands`);

// Deploy commands to Discord
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('\n🚀 Starting deployment of application (/) commands...');
        
        // Deploy globally (to all servers the bot is in)
        const data = await rest.put(
            Routes.applicationCommands(CLIENT_ID),
            { body: commands },
        );

        console.log(`✅ Successfully deployed ${data.length} application commands globally!`);
        
        // Show deployed commands
        console.log('\n📋 Deployed commands:');
        data.forEach(cmd => {
            console.log(`  - /${cmd.name}: ${cmd.description}`);
            if (cmd.options && cmd.options.length > 0) {
                const optionNames = cmd.options.map(opt => {
                    const required = opt.required ? '(required)' : '(optional)';
                    return `${opt.name} ${required}`;
                });
                console.log(`    Options: ${optionNames.join(', ')}`);
            }
        });
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        process.exit(1);
    }
})();