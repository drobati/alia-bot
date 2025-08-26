const { REST, Routes } = require('discord.js');
const fs = require('node:fs');
const path = require('node:path');

// Load configuration from config file
const configPath = path.join(__dirname, 'scripts/discord-commands/config-dev.json');
const config = JSON.parse(fs.readFileSync(configPath, 'utf8'));

const clientId = config.clientId;
const guildId = config.guildId;
const token = config.token;

console.log('=== DEPLOYMENT CONFIGURATION ===');
console.log(`Client ID: ${clientId}`);
console.log(`Guild ID: ${guildId}`);
console.log(`Bot Token: ${token ? 'Present' : 'Missing'}`);

if (!clientId || !token) {
    console.error('Missing CLIENT_ID or BOT_TOKEN environment variables');
    process.exit(1);
}

const commands = [];
const commandsPath = path.join(__dirname, 'dist/src/commands');

console.log(`Looking for commands in: ${commandsPath}`);

try {
    const commandFiles = fs.readdirSync(commandsPath).filter(file => file.endsWith('.js') && !file.endsWith('.test.js'));
    console.log(`Found command files: ${commandFiles.join(', ')}`);

    for (const file of commandFiles) {
        const filePath = path.join(commandsPath, file);
        try {
            const command = require(filePath);
            const commandModule = command.default || command;
            
            if ('data' in commandModule && 'execute' in commandModule) {
                commands.push(commandModule.data.toJSON());
                console.log(`✓ Loaded command: ${commandModule.data.name}`);
            } else {
                console.log(`⚠ Warning: ${filePath} is missing required "data" or "execute" property`);
            }
        } catch (error) {
            console.error(`✗ Error loading ${file}:`, error.message);
        }
    }
} catch (error) {
    console.error('Error reading commands directory:', error.message);
    process.exit(1);
}

console.log(`Commands found: ${commands.length}`);
console.log('Command names:', commands.map(cmd => cmd.name).join(', '));
console.log('=====================================');

const rest = new REST().setToken(token);

(async () => {
    try {
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
        
        console.log(`Deploying ${deployType}`);

        const data = await rest.put(route, { body: commands });

        console.log(`✅ Successfully deployed ${data.length} application (/) commands ${guildId ? 'to guild' : 'globally'}.`);
        
        if (guildId) {
            console.log('Commands deployed to guild - should appear immediately in the specified server!');
        } else {
            console.log('Commands deployed globally - will appear on ALL servers within 1 hour');
        }
    } catch (error) {
        console.error('Deployment failed:', error);
        if (error.status === 401) {
            console.error('Invalid bot token - check BOT_TOKEN environment variable');
        } else if (error.status === 403) {
            console.error('Bot lacks permissions - ensure bot has applications.commands scope');
        }
    }
})();