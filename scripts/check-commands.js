#!/usr/bin/env node

/**
 * Check all Discord command registrations (global and guild-specific)
 * This helps identify if guild commands are overriding global ones
 */

const { REST, Routes } = require('discord.js');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465';
const GUILD_ID = process.env.GUILD_ID || '772638687854231563'; // Arrakis Discord guild

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment variables');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

(async () => {
    try {
        console.log('🔍 Checking Discord command registrations...\n');
        
        // Check global commands
        console.log('📋 Global Commands:');
        try {
            const globalCommands = await rest.get(Routes.applicationCommands(CLIENT_ID));
            
            if (globalCommands.length === 0) {
                console.log('   No global commands found');
            } else {
                globalCommands.forEach(cmd => {
                    console.log(`   - ${cmd.name}: ${cmd.description}`);
                    if (cmd.name === 'speak') {
                        console.log('     🎯 Speak command options:');
                        cmd.options.forEach(opt => {
                            console.log(`       - ${opt.name}: ${opt.description} ${opt.required ? '(required)' : '(optional)'}`);
                        });
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error fetching global commands:', error.message);
        }
        
        console.log('\n📋 Guild Commands (Arrakis Discord):');
        try {
            const guildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, GUILD_ID));
            
            if (guildCommands.length === 0) {
                console.log('   No guild-specific commands found');
            } else {
                guildCommands.forEach(cmd => {
                    console.log(`   - ${cmd.name}: ${cmd.description}`);
                    if (cmd.name === 'speak') {
                        console.log('     🎯 Guild Speak command options:');
                        cmd.options.forEach(opt => {
                            console.log(`       - ${opt.name}: ${opt.description} ${opt.required ? '(required)' : '(optional)'}`);
                        });
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error fetching guild commands:', error.message);
        }
        
        // Additional guild check with a different ID if provided
        const altGuildId = '1174084919354474587'; // From .env comments
        console.log(`\n📋 Alternative Guild Commands (${altGuildId}):`);
        try {
            const altGuildCommands = await rest.get(Routes.applicationGuildCommands(CLIENT_ID, altGuildId));
            
            if (altGuildCommands.length === 0) {
                console.log('   No commands found for alternative guild');
            } else {
                altGuildCommands.forEach(cmd => {
                    console.log(`   - ${cmd.name}: ${cmd.description}`);
                    if (cmd.name === 'speak') {
                        console.log('     🎯 Alt Guild Speak command options:');
                        cmd.options.forEach(opt => {
                            console.log(`       - ${opt.name}: ${opt.description} ${opt.required ? '(required)' : '(optional)'}`);
                        });
                    }
                });
            }
        } catch (error) {
            console.error('❌ Error fetching alternative guild commands:', error.message);
        }
        
        console.log('\n💡 Discord Command Resolution Order:');
        console.log('   1. Guild-specific commands override global commands');
        console.log('   2. If guild commands exist for a name, global is hidden');
        console.log('   3. Users only see the highest priority version');
        
        console.log('\n✅ Command check complete!');
        
    } catch (error) {
        console.error('❌ Error checking commands:', error);
        process.exit(1);
    }
})();