import { Client, Events, EmbedBuilder } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import server from '../src/lib/server';
import { stripIndent } from 'common-tags';
import config from 'config';
import { safelyFindChannel, safelySendToChannel, isTextChannel } from '../src/utils/discordHelpers';

const clientReadyEvent: BotEvent = {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client, context: Context) {
        const { tables, log, VERSION } = context;

        log.info(stripIndent`
            One day each of you will come face to face with the horror of your own existence.
            One day you will cry out for help. One day each of you will find yourselves alone.
        `);

        const devChannel = safelyFindChannel(client, 'deploy', isTextChannel, context);

        // Get owner configuration for deployment message
        const ownerId = config.get<string>('owner');

        // Log owner configuration to application logs
        log.info('=== BOT OWNER CONFIGURATION (READY EVENT) ===');
        log.info(`Configured Owner ID: ${ownerId}`);
        log.info(`Owner ID Type: ${typeof ownerId}`);
        log.info(`Environment: ${process.env.NODE_ENV}`);
        log.info('=============================================');

        const deploymentMessage = stripIndent`
            🚀 **Successfully deployed on ${process.env.NODE_ENV}**
            **Version:** ${VERSION}
            **Bot Owner ID:** ${ownerId}
            **Owner ID Type:** ${typeof ownerId}
            **Timestamp:** ${new Date().toISOString()}
        `;

        const deploymentSent = await safelySendToChannel(
            devChannel,
            deploymentMessage,
            context,
            'deployment notification',
        );
        if (!deploymentSent) {
            log.error("Failed to send deployment message to 'deploy' channel");
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
                                await safelySendToChannel(
                                    devChannel,
                                    `✅ Table ${key} synced successfully`,
                                    context,
                                    `table sync success: ${key}`,
                                );
                            } else {
                                log.error(`[SYNC] ❌ Table ${key} does not have sync method`);
                                await safelySendToChannel(
                                    devChannel,
                                    `❌ Table ${key} missing sync method`,
                                    context,
                                    `table sync error: ${key}`,
                                );
                            }
                        } catch (syncError) {
                            log.error(`[SYNC] ❌ Error syncing table '${key}':`, syncError);
                            const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);
                            await safelySendToChannel(
                                devChannel,
                                `❌ Error syncing table '${key}': ${errorMsg}`,
                                context,
                                `table sync error: ${key}`,
                            );
                        }
                    }

                    log.info('=== TABLE SYNC COMPLETED ===');
                } else {
                    log.error('❌ No tables found in tables object!');
                    await safelySendToChannel(
                        devChannel,
                        '❌ CRITICAL: No tables found in tables object!',
                        context,
                        'table sync critical error',
                    );
                }
            } else {
                log.error('❌ Tables object is null/undefined!');
                await safelySendToChannel(
                    devChannel,
                    '❌ CRITICAL: Tables object is null/undefined!',
                    context,
                    'table sync critical error',
                );
            }
        } catch (tableDebugError) {
            log.error('❌ Critical error in table sync debug:', tableDebugError);
            const errorMsg = tableDebugError instanceof Error ? tableDebugError.message : String(tableDebugError);
            await safelySendToChannel(
                devChannel,
                `❌ CRITICAL TABLE SYNC ERROR: ${errorMsg}`,
                context,
                'table sync critical error',
            );
        }

        // Start server for webhooks
        const genChannel = safelyFindChannel(client, 'general', isTextChannel, context);

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
            log.error("Failed to find 'general' channel - server webhooks may not work properly");
        }
    },
};

export default clientReadyEvent;
