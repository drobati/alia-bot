import { Client } from 'discord.js';
import { Sequelize } from 'sequelize';
import { listenForLouds } from './responses/louds';
import { setupLouds } from './models/louds';

// Create new client
const client = new Client();
const PREFIX = '!';

const sequelize = new Sequelize('database', 'user', 'password', {
    host: 'localhost',
    dialect: 'sqlite',
    logging: false,
    operatorsAliases: false,
    // SQLite only
    storage: 'database.sqlite',
});

const { Louds, Louds_Banned } = setupLouds(sequelize);

// Startup message
client.once('ready', () => {
    Louds.sync();
    Louds_Banned.sync();
    console.log(
        `One day each of you will come face to face with the horror of your own existence.
        One day you will cry out for help. One day each of you will find yourselves alone.!`
    );
});

client.login(process.env.BOT_TOKEN);

client.on('message', async message => {
    if (message.content.startsWith(PREFIX)) {
        const input = message.content.slice(PREFIX.length).split(' ');
        const command = input.shift();
        // const commandArgs = input.join(' ');

        if (command === 'fear') {
            message.channel.send('Fear is the mindkiller.');
        } else if (command === 'loud') {
            // TODO: Add loud commands.
        }
    }
});

client.on('message', listenForLouds);
