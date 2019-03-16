import { Client } from 'discord.js';

import { listenForLouds } from './scripts/louds';

// Create new client
const client = new Client();

// Startup message
client.once('ready', () => {
    console.log(
        'One day each of you will come face to face with the horror of your own existence. One day you will cry out for help. One day each of you will find yourselves alone.!'
    );
});

client.login(process.env.BOT_TOKEN);

client.on('message', listenForLouds);
