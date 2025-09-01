#!/usr/bin/env node

/**
 * Deploy updated commands to production guild servers
 * This will update the guild-specific commands to include the tone option
 */

const { REST, Routes } = require('discord.js');
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

async function getProdToken() {
    try {
        const result = execSync('aws ssm get-parameter --name "BOT_TOKEN" --with-decryption --query "Parameter.Value" --output text', { encoding: 'utf8' });
        return result.trim();
    } catch (error) {
        console.error('❌ Failed to get production BOT_TOKEN from Parameter Store:', error.message);
        process.exit(1);
    }
}

(async () => {
    try {
        console.log('🔍 Getting production bot token from AWS Parameter Store...');
        const BOT_TOKEN = await getProdToken();
        
        // Extract client ID from token
        const CLIENT_ID = Buffer.from(BOT_TOKEN.split('.')[0], 'base64').toString();
        console.log(`🤖 Production Client ID: ${CLIENT_ID}`);
        
        // Production guild IDs
        const PRODUCTION_GUILDS = [
            { id: '205526497769947136', name: 'cerebral discharge' },
            { id: '1352767815958007879', name: '【ＤＲＩＦＴ-】' }
        ];
        
        const commands = [];
        const commandsPath = path.join(__dirname, '..', 'dist', 'src', 'commands');
        
        // Load all command files
        console.log('📦 Loading commands...');
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
                        
                        const hasTone = commandData.options.find(opt => opt.name === 'tone');
                        if (hasTone) {
                            console.log('✅ Tone option confirmed in loaded commands');
                        } else {
                            console.error('❌ WARNING: Tone option missing from loaded commands!');
                        }
                    }
                }
            } catch (error) {
                console.error(`❌ Error loading ${file}:`, error.message);
            }
        }
        
        console.log(`\n📦 Loaded ${commands.length} commands total`);
        
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        
        // Deploy to each production guild
        for (const guild of PRODUCTION_GUILDS) {
            try {
                console.log(`\n🚀 Deploying to guild: ${guild.name} (${guild.id})`);
                
                const guildData = await rest.put(
                    Routes.applicationGuildCommands(CLIENT_ID, guild.id),
                    { body: commands },
                );
                
                console.log(`✅ Deployed ${guildData.length} commands to ${guild.name}!`);
                
                // Verify speak command deployment
                const deployedSpeak = guildData.find(cmd => cmd.name === 'speak');
                if (deployedSpeak) {
                    console.log(`🔍 Verifying /speak command in ${guild.name}:`);
                    deployedSpeak.options.forEach(opt => {
                        console.log(`   - ${opt.name}: ${opt.description}`);
                    });
                    
                    const hasTone = deployedSpeak.options.find(opt => opt.name === 'tone');
                    if (hasTone) {
                        console.log(`✅ Tone option successfully deployed to ${guild.name}!`);
                    } else {
                        console.error(`❌ WARNING: Tone option still missing in ${guild.name}!`);
                    }
                } else {
                    console.error(`❌ /speak command not found in deployed commands for ${guild.name}!`);
                }
                
            } catch (error) {
                console.error(`❌ Error deploying to guild ${guild.name}:`, error.message);
            }
        }
        
        console.log('\n✨ Production guild deployment complete!');
        console.log('📝 Note: It may take a few minutes for Discord to update the command interface.');
        console.log('💡 Try refreshing Discord (Ctrl+R or Cmd+R) if commands don\'t appear immediately.');
        console.log('\n🎯 The tone option should now be available in both production servers:');
        console.log('   - cerebral discharge');
        console.log('   - 【ＤＲＩＦＴ-】');
        
    } catch (error) {
        console.error('❌ Script error:', error);
        process.exit(1);
    }
})();