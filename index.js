const { stripIndent } = require('common-tags');
const { Client, Collection, EmbedBuilder, Events, GatewayIntentBits, Partials } = require('discord.js');
const db = require('sequelize');
const server = require('./src/lib/server');
const response = require('./src/responses');
const models = require('./src/models');
const config = require('config');
const bunyan = require('bunyan');
const { join } = require("path");
const { readdirSync } = require("fs");

const VERSION = '2.0.0';

// Create new client
const client = new Client({ intents: [GatewayIntentBits.Guilds], partials: [Partials.Channel] });
const log = bunyan.createLogger({ name: 'aliabot', level: config.get('level') });

log.info(`NODE_ENV: ${process.env.NODE_ENV}`);
log.info(
    `Connecting to ${config.get('database.user')}@${process.env.DB_HOST}/${config.get(
        'database.name'
    )}`
);
const sequelize = new db.Sequelize(
    config.get('database.name'),
    config.get('database.user'),
    process.env.DB_PASSWORD,
    { ...config.get('database.options'), host: process.env.DB_HOST }
);

const Adlibs = models.Adlibs(sequelize);
const Config = models.Config(sequelize);
const { Memories } = models.Memories(sequelize);
const { Louds, Louds_Banned } = models.Louds(sequelize);
const { Twitch_Users, Twitch_Notifications } = models.Twitch(sequelize);

// Startup message
client.once('ready', () => {
    // Sync tables.
    Adlibs.sync();
    Config.sync();
    Louds.sync();
    Louds_Banned.sync();
    Memories.sync();
    Twitch_Users.sync();
    Twitch_Notifications.sync();

    // Announcements
    log.info(stripIndent`
        One day each of you will come face to face with the horror of your own existence.
        One day you will cry out for help. One day each of you will find yourselves alone.
    `);
    const devChannel = client.channels.cache.find((chan) => chan.name === 'deploy');
    devChannel.send(`Successfully deployed on ${process.env.NODE_ENV}. Version ${VERSION}.`);

    // Start server for webhooks.
    const genChannel = client.channels.cache.find((chan) => chan.name === 'general');
    const twitchEmbed = new EmbedBuilder();
    server(client, genChannel, twitchEmbed, { Twitch_Users, Twitch_Notifications }).then((r) =>
        log.info(r)
    );
});

client.login(process.env.BOT_TOKEN).then(() => {
    log.info(`Logged in. Version ${VERSION}`);
});

client.commands = new Collection();

const commandsPath = join(__dirname, 'src/commands');
const commandFiles = readdirSync(commandsPath).filter(file => file.endsWith('.js'));

for (const file of commandFiles) {
    const filePath = join(commandsPath, file);
    // ignore test.js files
    if (filePath.includes('test.js')) continue;
    const command = require(filePath);
    // Set a new item in the Collection with the key as the command name and the value as the exported module
    if ('data' in command && 'execute' in command) {
        client.commands.set(command.data.name, command);
    } else {
        // Common error while converting old commands.
        log.warn(`The command at ${filePath} is missing a required "data" or "execute" property.`);
    }
}

client.on(Events.InteractionCreate, async interaction => {
    if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
        log.error(`Interaction ${interaction.commandName} is not a chat input command or autocomplete`);
        return;
    }

    const command = interaction.client.commands.get(interaction.commandName);

    if (!command) {
        log.error(`No command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        const context = {
            log,
            Adlibs,
            Config,
            Louds,
            Louds_Banned,
            Memories,
            Twitch_Users,
            Twitch_Notifications
        }
        if (interaction.isAutocomplete()) {
            log.info(`Autocompleting ${interaction.commandName}`);
            await command.autocomplete(interaction, context);
        } else if (interaction.isCommand()) {
            log.info(`Executing ${interaction.commandName}`);
            await command.execute(interaction, context);
        }
    } catch (error) {
        log.error(error);
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
});

client.on(Events.MessageCreate, async message => {
    try {
        if (message.author.bot) return '';

        await response.Louds(message, Louds, Louds_Banned);
        await response.Adlibs(message, Adlibs);
        await response.Triggers(message, Memories);
    } catch (error) {
        log.error(error);
    }
});
