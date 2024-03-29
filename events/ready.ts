import { Client, ChannelType, Events, EmbedBuilder, TextChannel } from 'discord.js';
import { Context, Event } from '../src/utils/types';
import server from '../src/lib/server';
import { stripIndent } from 'common-tags';

const clientReadyEvent: Event = {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client, context: Context) {
        const { tables, log, VERSION } = context;

        log.info(stripIndent`
            One day each of you will come face to face with the horror of your own existence.
            One day you will cry out for help. One day each of you will find yourselves alone.
        `);

        const devChannel = client.channels.cache.find((chan): chan is TextChannel =>
            chan.type === ChannelType.GuildText && chan.name === 'deploy',
        ) as TextChannel | undefined;

        if (devChannel) {
            await devChannel.send(`Successfully deployed on ${process.env.NODE_ENV}. Version ${VERSION}.`);
        } else {
            log.error("Failed to find 'deploy' channel.");
        }

        // Sync tables with error handling
        Object.keys(tables).forEach(key => {
            try {
                tables[key].sync();
            } catch (error) {
                if (error instanceof Error) {
                    log.error(`Error syncing table '${key}': ${error.message}`);
                    devChannel?.send(`Error syncing table '${key}': ${error.message}`);
                }
            }
        });

        // Start server for webhooks
        const genChannel = client.channels.cache.find((chan): chan is TextChannel =>
            chan.type === ChannelType.GuildText && chan.name === 'general',
        ) as TextChannel | undefined;

        if (genChannel) {
            const twitchEmbed = new EmbedBuilder();
            try {
                const result = await server(client, genChannel, twitchEmbed, tables);
                log.info(result);
            } catch (error) {
                if (error instanceof Error) {
                    log.error(`An error occurred: ${error.message}`);
                }
            }
        } else {
            log.error("Failed to find 'general' channel.");
        }
    },
};

export default clientReadyEvent;
