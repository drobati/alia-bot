import { Client, Events, EmbedBuilder } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import server from '../src/lib/server';
import { stripIndent } from 'common-tags';
import { safelyFindChannel, safelySendToChannel, isTextChannel } from '../src/utils/discordHelpers';

const clientReadyEvent: BotEvent = {
    name: Events.ClientReady,
    once: true,
    async execute(client: Client, context: Context) {
        const { tables, log, VERSION, COMMIT_SHA } = context;

        log.info(stripIndent`
            One day each of you will come face to face with the horror of your own existence.
            One day you will cry out for help. One day each of you will find yourselves alone.
        `);

        const devChannel = safelyFindChannel(client, 'deploy', isTextChannel, context);

        // Short commit SHA for display
        const shortSha = COMMIT_SHA.substring(0, 7);

        const deploymentMessage = stripIndent`
            🚀 **Successfully deployed on ${process.env.NODE_ENV}**
            **Version:** ${VERSION}
            **Commit:** ${shortSha}
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

        // Sync database tables
        try {
            const tableKeys = Object.keys(tables);
            if (tableKeys.length === 0) {
                log.error({ category: 'database' }, 'No tables found in tables object');
                return;
            }

            const syncErrors: string[] = [];
            for (const key of tableKeys) {
                try {
                    if (tables[key]?.sync && typeof tables[key].sync === 'function') {
                        await tables[key].sync();
                    }
                } catch (syncError) {
                    const errorMsg = syncError instanceof Error ? syncError.message : String(syncError);
                    syncErrors.push(`${key}: ${errorMsg}`);
                    log.error({ error: syncError, table: key, category: 'database' }, `Error syncing table ${key}`);
                }
            }

            if (syncErrors.length > 0) {
                await safelySendToChannel(
                    devChannel,
                    `⚠️ Database sync completed with ${syncErrors.length} error(s)`,
                    context,
                    'table sync errors',
                );
            }

            log.info({ tables: tableKeys, errors: syncErrors.length, category: 'database' }, 'Database tables synced');
        } catch (tableSyncError) {
            log.error({ error: tableSyncError, category: 'database' }, 'Critical error during table sync');
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
