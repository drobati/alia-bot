import { EmbedBuilder } from 'discord.js';
import { EventHandler, EventContext, EventResult, ValidationResult } from './types';
import { HypePayload, ScheduledEventAttributes } from '../../models/scheduledEvent';

/**
 * Handler for hype events
 * Sends countdown announcements leading up to an event
 */
export const HypeHandler: EventHandler = {
    type: 'hype',

    async execute(ctx: EventContext): Promise<EventResult> {
        const { channel, payload } = ctx;
        const hypePayload = payload as HypePayload;

        if (!channel) {
            return {
                success: false,
                message: 'Channel not found or not accessible',
            };
        }

        try {
            const eventTime = new Date(hypePayload.eventTime);
            const now = new Date();
            const remaining = eventTime.getTime() - now.getTime();
            const tier = hypePayload.announcementTier;
            const isNow = tier === 'now' || tier === '0m' || remaining <= 0;

            const embed = new EmbedBuilder()
                .setColor(isNow ? 0xFEE75C : 0x5865F2)
                .setTitle(isNow
                    ? `\u{1F389} ${hypePayload.eventName} - IT'S TIME!`
                    : `\u{23F3} ${hypePayload.eventName}`)
                .setTimestamp();

            if (isNow) {
                embed.setDescription(
                    hypePayload.description
                        ? `**${hypePayload.description}**\n\nThe wait is over!`
                        : 'The wait is over!',
                );
            } else {
                const countdown = formatCountdown(remaining);
                embed.setDescription(
                    (hypePayload.description ? `${hypePayload.description}\n\n` : '') +
                    `**${countdown}** remaining!`,
                );
                embed.setFooter({ text: `Event at ${eventTime.toLocaleString()}` });
            }

            await channel.send({ embeds: [embed] });

            return { success: true, shouldReschedule: false };

        } catch (error) {
            return {
                success: false,
                message: 'Failed to send hype announcement',
                error: error as Error,
            };
        }
    },

    validate(payload: unknown): ValidationResult {
        const data = payload as Partial<HypePayload>;

        if (!data.eventName || typeof data.eventName !== 'string') {
            return { valid: false, error: 'Event name is required' };
        }

        if (data.eventName.length > 100) {
            return { valid: false, error: 'Event name must be under 100 characters' };
        }

        if (data.description && data.description.length > 500) {
            return { valid: false, error: 'Description must be under 500 characters' };
        }

        if (!data.eventTime) {
            return { valid: false, error: 'Event time is required' };
        }

        return { valid: true };
    },

    formatDisplay(event: ScheduledEventAttributes): string {
        try {
            const payload = JSON.parse(event.payload) as HypePayload;
            const preview = payload.eventName.length > 40
                ? `${payload.eventName.substring(0, 37)}...`
                : payload.eventName;
            return `"${preview}" (${payload.announcementTier})`;
        } catch {
            return '"Unknown hype event"';
        }
    },
};

/**
 * Format milliseconds as a human-readable countdown
 */
function formatCountdown(ms: number): string {
    if (ms <= 0) return '0 minutes';

    const days = Math.floor(ms / (1000 * 60 * 60 * 24));
    const hours = Math.floor((ms % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((ms % (1000 * 60 * 60)) / (1000 * 60));

    const parts: string[] = [];
    if (days > 0) parts.push(`${days} day${days !== 1 ? 's' : ''}`);
    if (hours > 0) parts.push(`${hours} hour${hours !== 1 ? 's' : ''}`);
    if (minutes > 0) parts.push(`${minutes} minute${minutes !== 1 ? 's' : ''}`);

    return parts.join(', ') || '< 1 minute';
}

/**
 * Parse an interval string (e.g., "24h", "15m") to milliseconds
 */
export function parseHypeInterval(interval: string): number | null {
    if (interval === 'now' || interval === '0m') return 0;

    const match = interval.match(/^(\d+)(h|m)$/);
    if (!match) return null;

    const value = parseInt(match[1], 10);
    const unit = match[2];

    if (unit === 'h') return value * 60 * 60 * 1000;
    if (unit === 'm') return value * 60 * 1000;
    return null;
}

/**
 * Default announcement tiers
 */
export const DEFAULT_HYPE_INTERVALS = ['24h', '1h', '15m', 'now'];
