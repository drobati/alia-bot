#!/usr/bin/env node

/**
 * Check what guilds the bot is in and their command status
 */

const { Client, GatewayIntentBits, REST, Routes } = require('discord.js');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465';

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment variables');
    process.exit(1);
}

const client = new Client({
    intents: [GatewayIntentBits.Guilds]
});

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

client.once('ready', async () => {
    try {
        console.log(`🤖 Logged in as ${client.user.tag}`);
        console.log(`📊 Bot is in ${client.guilds.cache.size} guilds:\n`);
        
        for (const [guildId, guild] of client.guilds.cache) {
            console.log(`🏰 ${guild.name} (${guildId})`);
            console.log(`   Members: ${guild.memberCount}`);
            
            // Check for guild-specific commands
            try {
                const guildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, guildId));
                
                if (guildCommands.length > 0) {
                    console.log(`   ⚠️ Has ${guildCommands.length} guild-specific commands:`);
                    
                    const speakCommand = guildCommands.find(cmd => cmd.name === 'speak');
                    if (speakCommand) {
                        console.log(`   🎯 SPEAK COMMAND FOUND - Options:`);
                        speakCommand.options.forEach(opt => {
                            console.log(`      - ${opt.name}: ${opt.description}`);
                        });
                        
                        const hasTone = speakCommand.options.find(opt => opt.name === 'tone');
                        if (!hasTone) {
                            console.log(`   ❌ MISSING TONE OPTION - This guild is overriding global commands!`);
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
        
        console.log('\n🌍 Global Commands Status:');
        try {
            const globalCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
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

client.login(BOT_TOKEN);