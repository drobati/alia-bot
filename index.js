const Discord = require('discord.js');

const louds = require('./scripts/louds');

// Create new client
const client = new Discord.Client();

// Startup message
client.once('ready', () => {
    console.log(
        'One day each of you will come face to face with the horror of your own existence. One day you will cry out for help. One day each of you will find yourselves alone.!'
    );
});

client.login(process.env.BOT_TOKEN);

client.on('message', louds.listenForLouds);
