const { stripIndent } = require('common-tags');
const Discord = require('discord.js');
const db = require('sequelize');
// TODO: Create index at each root folder for single import.
const response = require('./responses');
const commands = require('./commands');
const models = require('./models');

// Create new client
const client = new Discord.Client();
const PREFIX = '!';

const sequelize = new db.Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    storage: 'database.sqlite',
});

const { Louds, Louds_Banned } = models.Louds(sequelize);
const Twitch = models.Twitch(sequelize);

// Startup message
client.once('ready', () => {
    Louds.sync();
    Louds_Banned.sync();
    Twitch.sync();
    console.log(stripIndent`
        One day each of you will come face to face with the horror of your own existence.
        One day you will cry out for help. One day each of you will find yourselves alone.!
    `);
    if (!process.env.DEBUG) {
        const channel = client.channels.get('205526497769947136');
        channel.send('Successfully deployed.');
    }
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
