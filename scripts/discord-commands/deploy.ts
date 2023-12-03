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
const commandsPath = path.join(__dirname, '../../src/commands');
const commandFiles = readdirSync(commandsPath).filter((file: any) => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    // ignore if file ends with .test.js
    if (file.endsWith('.test.js')) {
        continue;
    }
    const command = require(filePath);
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
        console.log(`Started refreshing ${commands.length} application (/) commands.`);

        // The put method is used to fully refresh all commands in the guild with the current set
        const data = await rest.put(
            Routes.applicationGuildCommands(clientId, guildId),
            { body: commands },
        );

        console.log(`Successfully reloaded ${data.length} application (/) commands.`);
    } catch (error) {
        // And of course, make sure you catch and log any errors!
        console.error(error);
    }
})();
