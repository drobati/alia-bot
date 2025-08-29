const { REST, Routes } = require('discord.js');

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID; // dev server
const token = process.env.BOT_TOKEN;

const rest = new REST().setToken(token);

(async () => {
    try {
        console.log('Started clearing application (/) commands.');

        // Clear guild commands
        await rest.put(Routes.applicationGuildCommands(clientId, guildId), { body: [] });
        console.log('Successfully cleared guild commands.');

        // Clear global commands (just in case)
        await rest.put(Routes.applicationCommands(clientId), { body: [] });
        console.log('Successfully cleared global commands.');

        console.log('All commands cleared. Restart bot to register fresh commands.');
    } catch (error) {
        console.error('Error clearing commands:', error);
    }
})();