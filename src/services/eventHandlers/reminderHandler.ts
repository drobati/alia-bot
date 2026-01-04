import { EmbedBuilder } from 'discord.js';
import { EventHandler, EventContext, EventResult, ValidationResult } from './types';
import { ReminderPayload, ScheduledEventAttributes } from '../../models/scheduledEvent';

/**
 * Handler for reminder events
 * Sends reminder messages to channels or DMs
 */
export const ReminderHandler: EventHandler = {
    type: 'reminder',

    async execute(ctx: EventContext): Promise<EventResult> {
        const { event, channel, payload } = ctx;
        const reminderPayload = payload as ReminderPayload;

        // Check if we have a valid channel
        if (!channel) {
            return {
                success: false,
                message: 'Channel not found or not accessible',
            };
        }

        try {
            // Build the reminder embed
            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setTitle('Reminder')
                .setDescription(reminderPayload.message)
                .setTimestamp()
                .setFooter({ text: `Reminder ID: ${event.eventId}` });

            // Build the message content
            let content = '';
            if (reminderPayload.mentionUser && !reminderPayload.sendDm) {
                content = `<@${event.creatorId}>`;
            }

            // Send the reminder
            await channel.send({
                content: content || undefined,
                embeds: [embed],
            });

            return {
                success: true,
                shouldReschedule: false, // Reminders are one-time by default
            };

        } catch (error) {
            return {
                success: false,
                message: 'Failed to send reminder message',
                error: error as Error,
            };
        }
    },

    validate(payload: unknown): ValidationResult {
        const data = payload as Partial<ReminderPayload>;

        if (!data.message || typeof data.message !== 'string') {
            return {
                valid: false,
                error: 'Reminder message is required',
            };
        }

        if (data.message.length === 0) {
            return {
                valid: false,
                error: 'Reminder message cannot be empty',
            };
        }

        if (data.message.length > 500) {
            return {
                valid: false,
                error: 'Reminder message must be under 500 characters',
            };
        }

        return { valid: true };
    },

    formatDisplay(event: ScheduledEventAttributes): string {
        try {
            const payload = JSON.parse(event.payload) as ReminderPayload;
            const preview = payload.message.length > 50
                ? `${payload.message.substring(0, 47)}...`
                : payload.message;
            return `"${preview}"`;
        } catch {
            return '"Unknown reminder"';
        }
    },
};
