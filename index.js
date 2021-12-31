const { stripIndent } = require('common-tags');
const { Client, Intents, MessageEmbed } = require('discord.js');
const db = require('sequelize');
const server = require('./src/lib/server');
const response = require('./src/responses');
const commands = require('./src/commands');
const models = require('./src/models');
const config = require('config');
const bunyan = require('bunyan');

// Create new client
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
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
    devChannel.send(`Successfully deployed on ${process.env.NODE_ENV}. ${process.env.VERSION}`);

    // Start server for webhooks.
    const genChannel = client.channels.cache.find((chan) => chan.name === 'general');
    const twitchEmbed = new MessageEmbed();
    server(client, genChannel, twitchEmbed, { Twitch_Users, Twitch_Notifications }).then((r) =>
        log.info(r)
    );
});

client.login(process.env.BOT_TOKEN).then(() => {
    log.info('Logged in.');
});

const callCommands = async (message) => {
    const command = message.content.slice(1).split(' ').shift();
    switch (command) {
        case 'adlib':
            return await commands.Adlibs(message, Adlibs);
        case 'coinbase':
            return await commands.Coinbase(message);
        case 'config':
            return await commands.Config(message, Config);
        case 'dadjoke':
            return await commands.DadJokes(message);
        case 'fear':
            return await message.channel.send('Fear is the mindkiller.');
        case 'loud':
            return await commands.Louds(message, Louds, Louds_Banned);
        case 'remember':
            return await commands.Memories(message, Memories);
        case 'twitch':
            return await commands.Twitch(message, Twitch_Users, Config, log);
        default:
            return message.reply("I don't know that command.");
    }
};

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return '';

        if (message.content.startsWith('!')) {
            await callCommands(message, Adlibs);
        }
    } catch (error) {
        log.error(error);
        await message.channel.send("I'm sorry, I'm having trouble processing that request.");
    }
});

client.on('messageCreate', async (message) => {
    try {
        if (message.author.bot) return '';

        await response.Louds(message, Louds, Louds_Banned);
        await response.Adlibs(message, Adlibs);
        await response.Triggers(message, Memories);
    } catch (error) {
        log.error(error);
    }
});

client.on('interactionCreate', async (interaction) => {
    try {
        if (!interaction.isCommand()) return;

        if (interaction.commandName === 'QR') {
            await commands.QR(interaction);
        }
    } catch (error) {
        log.error(error);
    }
});
