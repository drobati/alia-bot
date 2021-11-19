const { stripIndent } = require('common-tags');
const { Client, Intents, MessageEmbed } = require('discord.js');
const db = require('sequelize');
const server = require('./lib/server');
const response = require('./responses');
const commands = require('./commands');
const models = require('./models');
const config = require('config');

// Create new client
const client = new Client({ intents: [Intents.FLAGS.GUILDS, Intents.FLAGS.GUILD_MESSAGES] });
const STATIC_PREFIX = '!';
const DYNAMIC_PREFIX = '?';

const sequelize = new db.Sequelize(
    process.env.DB_NAME,
    config.get('database.user'),
    process.env.DB_PASSWORD,
    config.get('database.options')
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
    console.log(stripIndent`
        One day each of you will come face to face with the horror of your own existence.
        One day you will cry out for help. One day each of you will find yourselves alone.
    `);
    if (process.env.NODE_ENV !== 'development') {
        const devChannel = client.channels.cache.find((chan) => chan.name === 'alia-bot');
        devChannel.send('Successfully deployed.');
    }

    // Start server for webhooks.
    const genChannel = client.channels.cache.find((chan) => chan.name === 'general');
    const twitchEmbed = new MessageEmbed();
    server(client, genChannel, twitchEmbed, { Twitch_Users, Twitch_Notifications }).then((r) =>
        console.log(r)
    );
});

client.login(process.env.BOT_TOKEN).then(() => {
    console.log('Logged in.');
});

client.on('messageCreate', async (message) => {
    if (message.author.bot) {
        return '';
    }

    // Commands can tell Alia to do something specific.
    //  STATIC_PREFIX are for strict command structures.
    //  DYNAMIC_PREFIX are for loose command structures.
    if (message.content.startsWith(STATIC_PREFIX)) {
        const input = message.content.slice(STATIC_PREFIX.length).split(' ');
        const command = input.shift();
        const commandArgs = input.join(' ');

        if (command === 'fear') {
            await message.channel.send('Fear is the mindkiller.');
        } else if (command === 'adlib') {
            await commands.Adlibs(message, commandArgs, { Adlibs });
        } else if (command === 'loud') {
            await commands.Louds(message, commandArgs, { Louds, Louds_Banned });
        } else if (command === 'twitch') {
            await commands.Twitch(message, commandArgs, { Twitch_Users, Config });
        } else if (command === 'config') {
            await commands.Config(message, commandArgs, { Config });
        } else if (command === 'dadjoke') {
            await commands.DadJokes(message);
        } else if (command === 'coinbase') {
            await commands.Coinbase(message, commandArgs);
        } else {
            return message.reply('Command not recognized.');
        }
    }

    if (message.content.startsWith(DYNAMIC_PREFIX)) {
        await commands.Memories(message, { Memories });
    }
});

client.on('messageCreate', async (message) => {
    // Alia doesn't respond to herself and other bots.
    if (message.author.bot) {
        return '';
    }

    // Call each response here. She will 'respond' to these functions.
    // They should have a regex, on what they are listening for.
    await response.Louds(message, { Louds, Louds_Banned });
    await response.Adlibs(message, { Adlibs });
});
