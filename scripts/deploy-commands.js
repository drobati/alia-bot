#!/usr/bin/env node

/**
 * Enhanced Discord Slash Commands Deployment
 * Supports environment-aware deployment, rollback, and validation
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
require('dotenv').config();

// Import command detection utilities
const { validateCommands } = require('./discord-commands/command-detector');

// Environment Configuration
const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465';
const GUILD_ID = process.env.GUILD_ID; // Optional: for guild-specific deployment
const ENVIRONMENT = process.env.NODE_ENV || 'development';
const DEPLOYMENT_MODE = process.argv.includes('--staging') ? 'staging' : 
                      process.argv.includes('--rollback') ? 'rollback' : 
                      'production';

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment variables');
    process.exit(1);
}

if (!CLIENT_ID) {
    console.error('❌ CLIENT_ID not found in environment variables');
    process.exit(1);
}

console.log('🔧 DEPLOYMENT CONFIGURATION');
console.log(`Environment: ${ENVIRONMENT}`);
console.log(`Deployment Mode: ${DEPLOYMENT_MODE}`);
console.log(`Guild-specific: ${GUILD_ID ? 'Yes (' + GUILD_ID + ')' : 'No (Global)'}`);
console.log('=============================\n');

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
        console.error(`❌ Error loading ${file}:`, error.message);
    }
}

console.log(`\n📦 Loaded ${commands.length} commands`);

// Validate commands before deployment
const validation = validateCommands(commands.map(cmd => ({
    name: cmd.name,
    description: cmd.description,
    options: cmd.options || [],
    developmentOnly: false, // This is filtered out above
    ownerOnly: false // Would need to be extracted from command metadata
})));

if (validation.errors.length > 0) {
    console.error('\n❌ VALIDATION ERRORS:');
    validation.errors.forEach(error => console.error(`  - ${error}`));
    process.exit(1);
}

if (validation.warnings.length > 0) {
    console.warn('\n⚠️ VALIDATION WARNINGS:');
    validation.warnings.forEach(warning => console.warn(`  - ${warning}`));
}

// Deploy commands to Discord
const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

/**
 * Save command backup for rollback purposes
 */
async function backupCurrentCommands(rest, route) {
    try {
        const currentCommands = await rest.get(route);
        const backupPath = path.join(__dirname, '..', 'command-backups');
        
        if (!fs.existsSync(backupPath)) {
            fs.mkdirSync(backupPath, { recursive: true });
        }
        
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        const backupFile = path.join(backupPath, `commands-backup-${timestamp}.json`);
        
        fs.writeFileSync(backupFile, JSON.stringify(currentCommands, null, 2));
        console.log(`💾 Commands backed up to: ${backupFile}`);
        
        return currentCommands;
    } catch (error) {
        console.warn(`⚠️ Could not backup current commands: ${error.message}`);
        return null;
    }
}

/**
 * Deploy with retry logic and rate limit handling
 */
async function deployWithRetry(rest, route, commands, maxRetries = 3) {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        try {
            console.log(`🚀 Deployment attempt ${attempt}/${maxRetries}...`);
            const data = await rest.put(route, { body: commands });
            return data;
        } catch (error) {
            if (error.code === 50035 && attempt < maxRetries) {
                console.warn(`⚠️ Validation error on attempt ${attempt}, retrying...`);
                await new Promise(resolve => setTimeout(resolve, 2000 * attempt));
                continue;
            }
            
            if (error.code === 429 && attempt < maxRetries) {
                const retryAfter = error.retry_after * 1000 || 5000;
                console.warn(`⚠️ Rate limited, waiting ${retryAfter}ms before retry...`);
                await new Promise(resolve => setTimeout(resolve, retryAfter));
                continue;
            }
            
            throw error;
        }
    }
}

(async () => {
    try {
        console.log('\n🚀 Starting deployment of application (/) commands...');
        
        // Determine deployment route
        const route = GUILD_ID ? 
            Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID) :
            Routes.applicationCommands(CLIENT_ID);
        
        const deploymentType = GUILD_ID ? `guild ${GUILD_ID}` : 'globally';
        console.log(`📡 Deploying ${deploymentType}...`);
        
        // Backup current commands for rollback
        if (DEPLOYMENT_MODE !== 'rollback') {
            await backupCurrentCommands(rest, route);
        }
        
        // Deploy commands with retry logic
        const data = await deployWithRetry(rest, route, commands);

        console.log(`✅ Successfully deployed ${data.length} application commands ${deploymentType}!`);
        
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
        
        // Verify deployment
        console.log('\n🔍 Verifying deployment...');
        const verifyData = await rest.get(route);
        
        if (verifyData.length !== commands.length) {
            throw new Error(`Deployment verification failed: Expected ${commands.length} commands, found ${verifyData.length}`);
        }
        
        console.log('✅ Deployment verification successful!');
        
        // Update deployment log
        const logEntry = {
            timestamp: new Date().toISOString(),
            environment: ENVIRONMENT,
            deploymentMode: DEPLOYMENT_MODE,
            commandCount: data.length,
            deploymentType,
            success: true
        };
        
        const logPath = path.join(__dirname, '..', 'deployment.log');
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        
        console.log(`\n🎉 Deployment completed successfully at ${logEntry.timestamp}`);
        
    } catch (error) {
        console.error('❌ Error deploying commands:', error);
        
        // Log failure
        const logEntry = {
            timestamp: new Date().toISOString(),
            environment: ENVIRONMENT,
            deploymentMode: DEPLOYMENT_MODE,
            error: error.message,
            success: false
        };
        
        const logPath = path.join(__dirname, '..', 'deployment.log');
        fs.appendFileSync(logPath, JSON.stringify(logEntry) + '\n');
        
        process.exit(1);
    }
})();