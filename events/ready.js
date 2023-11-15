const { Events, EmbedBuilder } = require('discord.js');
const server = require('../src/lib/server');
const { stripIndent } = require('common-tags');

module.exports = {
    name: Events.ClientReady,
    once: true,
    async execute(client, context) {
        const { tables, log, VERSION } = context;

        // Announcements
        log.info(stripIndent`
            One day each of you will come face to face with the horror of your own existence.
            One day you will cry out for help. One day each of you will find yourselves alone.
        `);

        const devChannel = client.channels.cache.find((chan) => chan.name === 'deploy');
        if (devChannel) {
            devChannel.send(`Successfully deployed on ${process.env.NODE_ENV}. Version ${VERSION}.`);
        } else {
            log.error("Failed to find 'deploy' channel.");
        }

        // Sync tables with error handling.
        Object.keys(tables).forEach((key) => {
            try {
                tables[key].sync();
            } catch (error) {
                log.error(`Error syncing table '${key}': ${error.message}`);
                devChannel.send(`Error syncing table '${key}': ${error.message}`);
            }
        });

        // Start server for webhooks.
        const genChannel = client.channels.cache.find((chan) => chan.name === 'general');
        if (genChannel) {
            const twitchEmbed = new EmbedBuilder();
            try {
                const result = await server(client, genChannel, twitchEmbed, tables);
                log.info(result);
            } catch (error) {
                log.error(`An error occurred: ${error.message}`);
            }
        } else {
            log.error("Failed to find 'general' channel.");
        }
    },
};