/* eslint-disable no-console */
import { REST, Routes } from "discord.js";
import path from "node:path";
import { readdirSync } from "fs";
import { join } from "path";

const clientId = process.env.CLIENT_ID;
const guildId = process.env.GUILD_ID;
const token = process.env.BOT_TOKEN;

const commands = [];
// Grab all the command files from the commands directory you created earlier
const commandsPath = path.join(__dirname, '../../dist/src/commands');
const commandFiles = readdirSync(commandsPath).filter((file: any) => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    // ignore if file ends with .test.js
    if (file.endsWith('.test.js')) {
        continue;
    }
    const command = require(filePath).default;
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        commands.push(command.data.toJSON());
    } else {
        // Common error while converting old commands.
        console.log(`[WARNING] The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

// Construct and prepare an instance of the REST module
const rest = new REST().setToken(token);

// and deploy your commands!
(async () => {
    try {
        console.log('=== DEPLOYMENT CONFIGURATION ===');
        console.log(`Client ID: ${clientId}`);
        console.log(`Guild ID: ${guildId} (not used for global commands)`);
        console.log(`Bot Token: ${token ? 'Present' : 'Missing'}`);
        console.log(`Commands found: ${commands.length}`);
        console.log('Command names:', commands.map(cmd => cmd.name).join(', '));
        console.log('=====================================');

        console.log(`Started refreshing ${commands.length} application (/) commands.`);
        
        let route;
        let deployType;
        if (guildId) {
            route = Routes.applicationGuildCommands(clientId, guildId);
            deployType = `GUILD-SPECIFIC (server ${guildId})`;
        } else {
            route = Routes.applicationCommands(clientId);
            deployType = 'GLOBALLY (all servers)';
        }
        
        console.log(`Deploying ${deployType} via:`, route);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(route, { body: commands });

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
        console.log('Commands deployed globally - will appear on ALL servers within 1 hour');
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
