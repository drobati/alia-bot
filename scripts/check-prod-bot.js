#!/usr/bin/env node

/**
 * Check production bot guilds and command status using production BOT_TOKEN
 */

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');

// Get production BOT_TOKEN from AWS Parameter Store
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
        
        const client = new Client({
            intents: [GatewayIntentBits.Guilds]
        });
        
        const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);
        
        client.once('ready', async () => {
            try {
                console.log(`🤖 Production bot logged in as ${client.user.tag}`);
                console.log(`📊 Production bot is in ${client.guilds.cache.size} guilds:\n`);
                
                for (const [guildId, guild] of client.guilds.cache) {
                    console.log(`🏰 ${guild.name} (${guildId})`);
                    console.log(`   Members: ${guild.memberCount}`);
                    
                    // Check for guild-specific commands
                    try {
                        const guildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, guildId));
                        
                        if (guildCommands.length > 0) {
                            console.log(`   ⚠️ Has ${guildCommands.length} guild-specific commands`);
                            
                            const speakCommand = guildCommands.find(cmd => cmd.name === 'speak');
                            if (speakCommand) {
                                console.log(`   🎯 GUILD SPEAK COMMAND - Options:`);
                                speakCommand.options.forEach(opt => {
                                    console.log(`      - ${opt.name}: ${opt.description}`);
                                });
                                
                                const hasTone = speakCommand.options.find(opt => opt.name === 'tone');
                                if (!hasTone) {
                                    console.log(`   ❌ MISSING TONE OPTION - Guild overriding global!`);
                                } else {
                                    console.log(`   ✅ Tone option present`);
                                }
                            }
                        } else {
                            console.log(`   ✅ No guild-specific commands (uses global)`);
                        }
                    } catch (error) {
                        console.log(`   ❌ Error checking guild commands: ${error.message}`);
                    }
                    
                    console.log('');
                }
                
                console.log('\n🌍 Production Global Commands Status:');
                try {
                    const globalCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
                    console.log(`📋 Found ${globalCommands.length} global commands`);
                    
                    const globalSpeak = globalCommands.find(cmd => cmd.name === 'speak');
                    
                    if (globalSpeak) {
                        console.log('✅ Global /speak command exists with options:');
                        globalSpeak.options.forEach(opt => {
                            console.log(`   - ${opt.name}: ${opt.description}`);
                        });
                        
                        const hasTone = globalSpeak.options.find(opt => opt.name === 'tone');
                        console.log(hasTone ? '✅ Global tone option present' : '❌ Global tone option missing');
                    } else {
                        console.log('❌ No global /speak command found');
                    }
                } catch (error) {
                    console.log(`❌ Error checking global commands: ${error.message}`);
                }
                
                process.exit(0);
                
            } catch (error) {
                console.error('❌ Error:', error);
                process.exit(1);
            }
        });
        
        console.log('🔗 Connecting to Discord...');
        await client.login(BOT_TOKEN);
        
    } catch (error) {
        console.error('❌ Script error:', error);
        process.exit(1);
    }
})();