import { EmbedBuilder, TextChannel, NewsChannel } from 'discord.js';
import { EventHandler, EventContext, EventResult, ValidationResult } from './types';
import { BirthdayPayload, ScheduledEventAttributes } from '../../models/scheduledEvent';

const BIRTHDAY_MESSAGES = [
    'Wishing you the happiest of birthdays!',
    'Hope your day is as amazing as you are!',
    'Another year of awesome begins today!',
    'May your birthday be filled with joy!',
    'Here\'s to another trip around the sun!',
];

/**
 * Handler for birthday events
 * Sends birthday celebration messages on the person's birthday.
 * Resolves the target channel from the birthday_channel config.
 */
export const BirthdayHandler: EventHandler = {
    type: 'birthday',

    async execute(ctx: EventContext): Promise<EventResult> {
        const { event, client, context, payload } = ctx;
        let { channel } = ctx;
        const birthdayPayload = payload as BirthdayPayload;

        // If no channel on the event, look up the configured birthday channel
        if (!channel) {
            const configKey = `birthday_channel_${event.guildId}`;
            const config = await context.tables.Config.findOne({ where: { key: configKey } });

            if (config?.value) {
                const fetched = client.channels.cache.get(config.value);
                if (fetched && fetched.isTextBased()) {
                    channel = fetched as TextChannel | NewsChannel;
                }
            }
        }

        if (!channel) {
            return {
                success: false,
                message: 'No birthday channel configured. Use /config birthday channel to set one.',
            };
        }

        try {
            const randomMessage = BIRTHDAY_MESSAGES[
                Math.floor(Math.random() * BIRTHDAY_MESSAGES.length)
            ];

            const greeting = birthdayPayload.customMessage || randomMessage;

            const embed = new EmbedBuilder()
                .setColor(0xFFD700)
                .setTitle(`\u{1F382} Happy Birthday, ${birthdayPayload.username}!`)
                .setDescription(greeting)
                .setTimestamp()
                .setFooter({ text: 'Birthday Bot' });

            await channel.send({
                content: `<@${birthdayPayload.userId}>`,
                embeds: [embed],
            });

            return { success: true, shouldReschedule: true };

        } catch (error) {
            return {
                success: false,
                message: 'Failed to send birthday message',
                error: error as Error,
            };
        }
    },

    validate(payload: unknown): ValidationResult {
        const data = payload as Partial<BirthdayPayload>;

        if (!data.userId || typeof data.userId !== 'string') {
            return { valid: false, error: 'User ID is required' };
        }

        if (!data.username || typeof data.username !== 'string') {
            return { valid: false, error: 'Username is required' };
        }

        if (!data.birthDate || typeof data.birthDate !== 'string') {
            return { valid: false, error: 'Birth date is required' };
        }

        // Validate MM-DD format
        const dateMatch = data.birthDate.match(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
        if (!dateMatch) {
            return { valid: false, error: 'Birth date must be in MM-DD format (e.g., 03-15)' };
        }

        if (data.customMessage && data.customMessage.length > 500) {
            return { valid: false, error: 'Custom message must be under 500 characters' };
        }

        return { valid: true };
    },

    formatDisplay(event: ScheduledEventAttributes): string {
        try {
            const payload = JSON.parse(event.payload) as BirthdayPayload;
            return `${payload.username} (${payload.birthDate})`;
        } catch {
            return 'Unknown birthday';
        }
    },
};

/**
 * Convert MM-DD to a cron schedule that fires at 9 AM on that date yearly
 */
export function birthdayToCron(birthDate: string): string {
    const [month, day] = birthDate.split('-');
    return `0 9 ${parseInt(day, 10)} ${parseInt(month, 10)} *`;
}
