const { stripIndent } = require('common-tags');
const Discord = require('discord.js');
const db = require('sequelize');
const server = require('./lib/server');
const response = require('./responses');
const commands = require('./commands');
const models = require('./models');

// Create new client
const client = new Discord.Client();
const PREFIX = '!';

// TODO: Update database with username and password.
const sequelize = new db.Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'database.sqlite',
});

const Config = models.Config(sequelize);
const { Louds, Louds_Banned } = models.Louds(sequelize);
const { Twitch_Users, Twitch_Notifications } = models.Twitch(sequelize);

// Startup message
client.once('ready', () => {
    // Sync tables.
    Config.sync();
    Louds.sync();
    Louds_Banned.sync();
    Twitch_Users.sync();
    Twitch_Notifications.sync();

    // Announcements
    console.log(stripIndent`
        One day each of you will come face to face with the horror of your own existence.
        One day you will cry out for help. One day each of you will find yourselves alone.
    `);
    const devChannel = client.channels.find(chan => chan.name === 'alia-bot');
    devChannel.send('Successfully deployed.');

    // Start server for webhooks.
    const genChannel = client.channels.find(chan => chan.name === 'general');
    const twitchEmbed = new Discord.RichEmbed();
    server(client, genChannel, twitchEmbed, { Twitch_Users, Twitch_Notifications });
});

client.login(process.env.BOT_TOKEN);

client.on('message', async message => {
    // Commands should never respond with PREFIX and command.
    // Commands can tell Alia to do something specific.
    if (message.content.startsWith(PREFIX)) {
        const input = message.content.slice(PREFIX.length).split(' ');
        const command = input.shift();
        const commandArgs = input.join(' ');

        if (command === 'fear') {
            message.channel.send('Fear is the mindkiller.');
        } else if (command === 'loud') {
            commands.Louds(message, commandArgs, { Louds, Louds_Banned });
        } else if (command === 'twitch') {
            commands.Twitch(message, commandArgs, { Twitch_Users, Config });
        } else if (command === 'config') {
            commands.Config(message, commandArgs, { Config });
        }
    }
});

client.on('message', async message => {
    // Alia doesn't respond to herslef and other bots.
    if (message.author.bot) {
        return '';
    }

    // Call each response here. She will 'respond' to these functions.
    // They should have a regex, on what they are listening for.
    await response.Louds(message, { Louds, Louds_Banned });
});
