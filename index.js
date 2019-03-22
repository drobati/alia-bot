const Discord = require('discord.js');
const db = require('sequelize');
// TODO: Create index at each root folder for single import.
const loudsResponse = require('./responses/louds');
const loudsModel = require('./models/louds');
const loudsCommands = require('./commands/louds');

// Create new client
const client = new Discord.Client();
const PREFIX = '!';

const sequelize = new db.Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    // SQLite only
    storage: 'database.sqlite',
});

const { Louds, Louds_Banned } = loudsModel(sequelize);

// Startup message
client.once('ready', () => {
    Louds.sync();
    Louds_Banned.sync();
    // TODO: add formating to text.
    // https://discordjs.guide/miscellaneous/useful-packages.html#common-tags
    console.log(
        `One day each of you will come face to face with the horror of your own existence.
One day you will cry out for help. One day each of you will find yourselves alone.!`
    );
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
            loudsCommands(message, commandArgs, { Louds, Louds_Banned });
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
    await loudsResponse(message, { Louds, Louds_Banned });
});
