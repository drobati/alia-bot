import { Client, EmbedBuilder, TextChannel } from 'discord.js';
import { Op } from 'sequelize';
import { Context } from '../utils/types';
import metaforge, { ArcEvent } from '../lib/apis/metaforge';
import {
    parseEventTypes,
    parseMaps,
    parseWarnMinutes,
} from '../models/arcEventSubscription';

const POLLING_INTERVAL_MS = 5 * 60 * 1000; // 5 minutes
const NOTIFICATION_CLEANUP_DAYS = 7; // Clean up notifications older than 7 days

interface SubscriptionMatch {
    subscription: any;
    config: any;
    warnMinutes: number;
}

export class ArcEventPollingService {
    private client: Client;
    private context: Context;
    private pollingInterval: ReturnType<typeof setInterval> | null = null;
    private isShuttingDown = false;

    constructor(client: Client, context: Context) {
        this.client = client;
        this.context = context;
    }

    /**
     * Initialize the polling service
     */
    async initialize(): Promise<void> {
        this.context.log.info(
            { category: 'arc_event_polling' },
            'Initializing ARC event polling service',
        );

        // Start polling
        this.startPolling();

        // Run initial check
        await this.checkEvents();

        // Schedule cleanup of old notifications
        await this.cleanupOldNotifications();

        this.context.log.info(
            { category: 'arc_event_polling' },
            'ARC event polling service initialized',
        );
    }

    /**
     * Start the polling interval
     */
    private startPolling(): void {
        this.pollingInterval = setInterval(async () => {
            if (this.isShuttingDown) { return; }
            await this.checkEvents();
        }, POLLING_INTERVAL_MS);

        this.context.log.info({
            intervalMs: POLLING_INTERVAL_MS,
            category: 'arc_event_polling',
        }, 'Started ARC event polling');
    }

    /**
     * Check for upcoming events and send notifications
     */
    private async checkEvents(): Promise<void> {
        try {
            // Get all events from the API
            const events = await metaforge.getEvents();
            const now = Date.now();

            // Get all active subscriptions across all guilds
            const subscriptions = await this.context.tables.ArcEventSubscription.findAll({
                where: { active: true },
            });

            if (subscriptions.length === 0) {
                this.context.log.debug({ category: 'arc_event_polling' },
                    'No active subscriptions found');
                return;
            }

            // Get guild configs
            const guildIds = [...new Set(subscriptions.map((s: any) => s.guild_id))];
            const configs = await this.context.tables.ArcEventConfig.findAll({
                where: { guild_id: { [Op.in]: guildIds } },
            });
            const configMap = new Map(configs.map((c: any) => [c.guild_id, c]));

            // Process each event
            for (const event of events) {
                // Skip events that have already started
                if (event.startTime <= now) { continue; }

                // Find matching subscriptions
                const matches = this.findMatchingSubscriptions(
                    event,
                    subscriptions,
                    configMap,
                    now,
                );

                // Send notifications for each match
                for (const match of matches) {
                    await this.sendNotification(event, match);
                }
            }

        } catch (error) {
            this.context.log.error({
                error,
                category: 'arc_event_polling',
            }, 'Error checking ARC events');
        }
    }

    /**
     * Find subscriptions that match an event
     */
    private findMatchingSubscriptions(
        event: ArcEvent,
        subscriptions: any[],
        configMap: Map<string, any>,
        now: number,
    ): SubscriptionMatch[] {
        const matches: SubscriptionMatch[] = [];
        const minutesUntilEvent = (event.startTime - now) / (60 * 1000);

        for (const sub of subscriptions) {
            // Check event type filter
            const eventTypes = parseEventTypes(sub.event_types);
            if (eventTypes && !eventTypes.includes(event.name)) {
                continue;
            }

            // Check map filter
            const maps = parseMaps(sub.maps);
            if (maps && !maps.includes(event.map)) {
                continue;
            }

            // Check warning times
            const warnMinutes = parseWarnMinutes(sub.warn_minutes);
            for (const warnMin of warnMinutes) {
                // Check if we're within the warning window (warn time +/- 3 minutes buffer)
                const buffer = 3;
                if (minutesUntilEvent <= warnMin + buffer && minutesUntilEvent >= warnMin - buffer) {
                    const config = configMap.get(sub.guild_id) || null;
                    matches.push({ subscription: sub, config, warnMinutes: warnMin });
                }
            }
        }

        return matches;
    }

    /**
     * Send notification for an event
     */
    private async sendNotification(event: ArcEvent, match: SubscriptionMatch): Promise<void> {
        const { subscription, config, warnMinutes } = match;

        // Check if we already sent this notification
        const existing = await this.context.tables.ArcEventNotification.findOne({
            where: {
                guild_id: subscription.guild_id,
                user_id: subscription.user_id,
                event_start_time: event.startTime,
                warn_minutes: warnMinutes,
            },
        });

        if (existing) {
            return; // Already sent
        }

        const embed = this.createEventEmbed(event, warnMinutes);

        // Send channel notification
        if (subscription.notify_channel && config?.announcement_channel_id) {
            if (!config || config.allow_channel_announcements !== false) {
                await this.sendChannelNotification(
                    subscription.guild_id,
                    config.announcement_channel_id,
                    subscription.user_id,
                    embed,
                    event,
                    warnMinutes,
                );
            }
        }

        // Send DM notification
        if (subscription.notify_dm) {
            if (!config || config.allow_dm_notifications !== false) {
                await this.sendDmNotification(
                    subscription.guild_id,
                    subscription.user_id,
                    embed,
                    event,
                    warnMinutes,
                );
            }
        }
    }

    /**
     * Create the event notification embed
     */
    private createEventEmbed(event: ArcEvent, warnMinutes: number): EmbedBuilder {
        const startTimestamp = Math.floor(event.startTime / 1000);
        const endTimestamp = Math.floor(event.endTime / 1000);

        const embed = new EmbedBuilder()
            .setColor(0xff6b35) // ARC Raiders orange
            .setTitle(`${event.name} - ${event.map}`)
            .setDescription(`**Starting in ${warnMinutes} minutes!**`)
            .addFields([
                { name: 'Map', value: event.map, inline: true },
                { name: 'Event', value: event.name, inline: true },
                { name: 'Starts', value: `<t:${startTimestamp}:R>`, inline: true },
                { name: 'Ends', value: `<t:${endTimestamp}:t>`, inline: true },
            ])
            .setFooter({ text: 'ARC Raiders Event Timer | Data from metaforge.app' })
            .setTimestamp(new Date(event.startTime));

        if (event.icon) {
            embed.setThumbnail(event.icon);
        }

        return embed;
    }

    /**
     * Send notification to a channel
     */
    private async sendChannelNotification(
        guildId: string,
        channelId: string,
        userId: string,
        embed: EmbedBuilder,
        event: ArcEvent,
        warnMinutes: number,
    ): Promise<void> {
        try {
            const channel = this.client.channels.cache.get(channelId) as TextChannel;
            if (!channel || !channel.isTextBased()) {
                this.context.log.warn({
                    channelId,
                    guildId,
                    category: 'arc_event_polling',
                }, 'Channel not found for ARC event notification');
                return;
            }

            await channel.send({
                content: `<@${userId}>`,
                embeds: [embed],
            });

            // Record the notification
            await this.context.tables.ArcEventNotification.create({
                guild_id: guildId,
                user_id: userId,
                event_name: event.name,
                event_map: event.map,
                event_start_time: event.startTime,
                warn_minutes: warnMinutes,
                notification_type: 'channel',
                sent_at: new Date(),
            });

            this.context.log.info({
                guildId,
                userId,
                eventName: event.name,
                eventMap: event.map,
                warnMinutes,
                category: 'arc_event_polling',
            }, 'Sent ARC event channel notification');

        } catch (error) {
            this.context.log.error({
                error,
                channelId,
                guildId,
                category: 'arc_event_polling',
            }, 'Failed to send ARC event channel notification');
        }
    }

    /**
     * Send notification via DM
     */
    private async sendDmNotification(
        guildId: string,
        userId: string,
        embed: EmbedBuilder,
        event: ArcEvent,
        warnMinutes: number,
    ): Promise<void> {
        try {
            const user = await this.client.users.fetch(userId);
            const dmChannel = await user.createDM();

            await dmChannel.send({
                embeds: [embed],
            });

            // Record the notification
            await this.context.tables.ArcEventNotification.create({
                guild_id: guildId,
                user_id: userId,
                event_name: event.name,
                event_map: event.map,
                event_start_time: event.startTime,
                warn_minutes: warnMinutes,
                notification_type: 'dm',
                sent_at: new Date(),
            });

            this.context.log.info({
                guildId,
                userId,
                eventName: event.name,
                eventMap: event.map,
                warnMinutes,
                category: 'arc_event_polling',
            }, 'Sent ARC event DM notification');

        } catch (error) {
            this.context.log.warn({
                error,
                userId,
                guildId,
                category: 'arc_event_polling',
            }, 'Failed to send ARC event DM notification (user may have DMs disabled)');
        }
    }

    /**
     * Clean up old notifications from the database
     */
    private async cleanupOldNotifications(): Promise<void> {
        try {
            const cutoffDate = new Date();
            cutoffDate.setDate(cutoffDate.getDate() - NOTIFICATION_CLEANUP_DAYS);

            const deleted = await this.context.tables.ArcEventNotification.destroy({
                where: {
                    sent_at: { [Op.lt]: cutoffDate },
                },
            });

            if (deleted > 0) {
                this.context.log.info({
                    deletedCount: deleted,
                    category: 'arc_event_polling',
                }, 'Cleaned up old ARC event notifications');
            }
        } catch (error) {
            this.context.log.error({
                error,
                category: 'arc_event_polling',
            }, 'Failed to clean up old notifications');
        }
    }

    /**
     * Shutdown the polling service
     */
    shutdown(): void {
        this.isShuttingDown = true;

        this.context.log.info(
            { category: 'arc_event_polling' },
            'Shutting down ARC event polling service',
        );

        if (this.pollingInterval) {
            clearInterval(this.pollingInterval);
            this.pollingInterval = null;
        }
    }
}
