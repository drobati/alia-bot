import { Client, ChannelType, Events, EmbedBuilder, TextChannel } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import server from '../src/lib/server';
import { stripIndent } from 'common-tags';
import config from 'config';

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

        // Get owner configuration for deployment message
        const ownerId = config.get<string>('owner');
        
        // Log owner configuration to application logs
        log.info('=== BOT OWNER CONFIGURATION (READY EVENT) ===');
        log.info(`Configured Owner ID: ${ownerId}`);
        log.info(`Owner ID Type: ${typeof ownerId}`);
        log.info(`Environment: ${process.env.NODE_ENV}`);
        log.info('=============================================');

        if (devChannel) {
            await devChannel.send(stripIndent`
                🚀 **Successfully deployed on ${process.env.NODE_ENV}**
                **Version:** ${VERSION}
                **Bot Owner ID:** ${ownerId}
                **Owner ID Type:** ${typeof ownerId}
                **Timestamp:** ${new Date().toISOString()}
            `);
        } else {
            log.error("Failed to find 'deploy' channel.");
        }

        // Debug table sync with comprehensive error handling
        try {
            log.info('=== TABLE SYNC DEBUG START ===');
            log.info(`Tables object exists: ${tables ? 'YES' : 'NO'}`);
            log.info(`Tables object type: ${typeof tables}`);

            if (tables) {
                const tableKeys = Object.keys(tables);
                log.info(`Number of tables found: ${tableKeys.length}`);
                log.info(`Table names: ${tableKeys.join(', ')}`);

                if (tableKeys.length > 0) {
                    log.info('Starting table sync process...');

                    for (const key of tableKeys) {
                        try {
                            log.info(`[SYNC] Starting sync for table: ${key}`);
                            log.info(`[SYNC] Table ${key} object type: ${typeof tables[key]}`);
                            const hasSyncMethod = typeof tables[key]?.sync === 'function' ? 'YES' : 'NO';
                            log.info(`[SYNC] Table ${key} has sync method: ${hasSyncMethod}`);

                            if (tables[key]?.sync && typeof tables[key].sync === 'function') {
                                await tables[key].sync();
                                log.info(`[SYNC] ✅ Successfully synced table: ${key}`);
                                devChannel?.send(`✅ Table ${key} synced successfully`);
                            } else {
                                log.error(`[SYNC] ❌ Table ${key} does not have sync method`);
                                devChannel?.send(`❌ Table ${key} missing sync method`);
                            }
                        } catch (syncError) {
                            log.error(`[SYNC] ❌ Error syncing table '${key}':`, syncError);
                            const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);
                            devChannel?.send(`❌ Error syncing table '${key}': ${errorMsg}`);
                        }
                    }

                    log.info('=== TABLE SYNC COMPLETED ===');
                } else {
                    log.error('❌ No tables found in tables object!');
                    devChannel?.send('❌ CRITICAL: No tables found in tables object!');
                }
            } else {
                log.error('❌ Tables object is null/undefined!');
                devChannel?.send('❌ CRITICAL: Tables object is null/undefined!');
            }
        } catch (tableDebugError) {
            log.error('❌ Critical error in table sync debug:', tableDebugError);
            const errorMsg = tableDebugError instanceof Error ? tableDebugError.message : String(tableDebugError);
            devChannel?.send(`❌ CRITICAL TABLE SYNC ERROR: ${errorMsg}`);
        }

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
