const { Events, EmbedBuilder } = require('discord.js');
const server = require('../src/lib/server');
const { stripIndent } = require('common-tags');

module.exports = {
    name: Events.ClientReady,
    once: true,
    execute(client, context) {
        const { tables, log, VERSION } = context;
        // Sync tables.
        Object.keys(tables).forEach((key) => {
            tables[key].sync();
        });

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
        server(client, genChannel, twitchEmbed, tables).then((r) =>
            log.info(r)
        );
    },
};