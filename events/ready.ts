import { Client, ChannelType, Events, EmbedBuilder, TextChannel } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import server from '../src/lib/server';
import { stripIndent } from 'common-tags';

const clientReadyEvent: BotEvent = {
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
        log.info(`Starting table sync for ${Object.keys(tables).length} tables: ${Object.keys(tables).join(', ')}`);
        Object.keys(tables).forEach(key => {
            try {
                log.info(`Syncing table: ${key}`);
                tables[key].sync();
                log.info(`Successfully synced table: ${key}`);
            } catch (error) {
                if (error instanceof Error) {
                    log.error(`Error syncing table '${key}': ${error.message}`);
                    devChannel?.send(`Error syncing table '${key}': ${error.message}`);
                }
            }
        });
        log.info('Table sync completed');

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
