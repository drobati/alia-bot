#!/usr/bin/env node

/**
 * Clear guild-specific commands that may be overriding global commands
 */

const { REST, Routes } = require('discord.js');
require('dotenv').config();

const BOT_TOKEN = process.env.BOT_TOKEN;
const CLIENT_ID = process.env.CLIENT_ID || '1174823897842061465';

if (!BOT_TOKEN) {
    console.error('❌ BOT_TOKEN not found in environment variables');
    process.exit(1);
}

const rest = new REST({ version: '10' }).setToken(BOT_TOKEN);

// Known guild IDs from .env and previous checks
const guildIds = [
    '772638687854231563', // Arrakis Discord guild (from GUILD_ID)
    '1174084919354474587', // Alternative guild (from .env comments)
];

(async () => {
    try {
        console.log('🧹 Clearing guild-specific commands...\n');
        
        for (const guildId of guildIds) {
            console.log(`Clearing commands for guild ${guildId}...`);
            try {
                await rest.put(Routes.applicationGuildCommands(CLIENT_ID, guildId), { body: [] });
                console.log(`✅ Cleared commands for guild ${guildId}`);
            } catch (error) {
                console.error(`❌ Error clearing guild ${guildId}: ${error.message}`);
            }
        }
        
        console.log('\n⏳ Waiting for Discord to process changes...');
        await new Promise(resolve => setTimeout(resolve, 3000));
        
        console.log('\n✅ Guild command clearing complete!');
        console.log('💡 Global commands should now take precedence');
        console.log('🔄 You may need to refresh Discord (Ctrl+R or Cmd+R) to see changes');
        
    } catch (error) {
        console.error('❌ Error clearing guild commands:', error);
        process.exit(1);
    }
})();