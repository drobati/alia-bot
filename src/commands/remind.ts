import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Context } from "../types";
import { parseTimeInput, formatRelativeTime, isFutureDate } from "../utils/timeParser";
import { ReminderPayload, parsePayload } from "../models/scheduledEvent";

export default {
    data: new SlashCommandBuilder()
        .setName('remind')
        .setDescription('Set reminders for yourself or the channel')
        .addSubcommand(subcommand =>
            subcommand
                .setName('me')
                .setDescription('Set a personal reminder')
                .addStringOption(option =>
                    option.setName('when')
                        .setDescription('When to remind you (e.g., "in 2 hours", "tomorrow at 3pm")')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('What to remind you about')
                        .setRequired(true)
                        .setMaxLength(500))
                .addBooleanOption(option =>
                    option.setName('dm')
                        .setDescription('Send reminder via DM instead of channel')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('channel')
                .setDescription('Set a reminder for this channel')
                .addStringOption(option =>
                    option.setName('when')
                        .setDescription('When to post the reminder')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('message')
                        .setDescription('The reminder message')
                        .setRequired(true)
                        .setMaxLength(500)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your active reminders'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel a reminder')
                .addStringOption(option =>
                    option.setName('reminder_id')
                        .setDescription('The reminder ID')
                        .setRequired(true)
                        .setAutocomplete(true))),

    async execute(interaction: any, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'me':
                    await handleRemindMe(interaction, context);
                    break;
                case 'channel':
                    await handleRemindChannel(interaction, context);
                    break;
                case 'list':
                    await handleList(interaction, context);
                    break;
                case 'cancel':
                    await handleCancel(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            context.log.error('Error executing remind command', { error, subcommand, userId: interaction.user.id });
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'An error occurred while executing the command.',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({ content: 'An error occurred while executing the command.', ephemeral: true });
            }
        }
    },

    async autocomplete(interaction: any, context: Context) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'reminder_id') {
            // Get user's active reminders for autocomplete
            if (!context.schedulerService) {
                await interaction.respond([]);
                return;
            }

            const reminders = await context.schedulerService.listEvents(interaction.guildId, {
                creatorId: interaction.user.id,
                eventType: 'reminder',
                status: 'active',
                limit: 25,
            });

            const choices = reminders.map((reminder: any) => {
                const payload = parsePayload<ReminderPayload>(reminder.payload);
                const preview = payload.message.length > 40
                    ? `${payload.message.substring(0, 37)}...`
                    : payload.message;
                return {
                    name: `${reminder.eventId}: ${preview}`,
                    value: reminder.eventId,
                };
            });

            await interaction.respond(choices);
        }
    },
};

async function handleRemindMe(interaction: any, context: Context) {
    const whenInput = interaction.options.getString('when');
    const message = interaction.options.getString('message');
    const sendDm = interaction.options.getBoolean('dm') ?? false;

    // Parse the time
    const parsed = parseTimeInput(whenInput);
    if (!parsed) {
        await interaction.reply({
            content: `Could not understand "${whenInput}". Try something like "in 2 hours" or "tomorrow at 3pm".`,
            ephemeral: true,
        });
        return;
    }

    // Validate future time
    if (!isFutureDate(parsed.date)) {
        await interaction.reply({
            content: 'Reminder time must be in the future.',
            ephemeral: true,
        });
        return;
    }

    // Check if scheduler service is available
    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    // Create the reminder payload
    const payload: ReminderPayload = {
        message,
        mentionUser: true,
        sendDm,
    };

    // Schedule the event
    const event = await context.schedulerService.scheduleEvent({
        guildId: interaction.guildId,
        channelId: sendDm ? null : interaction.channelId,
        creatorId: interaction.user.id,
        eventType: 'reminder',
        payload,
        scheduleType: 'once',
        executeAt: parsed.date,
    });

    // Build confirmation embed
    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Reminder Set')
        .setDescription(`I'll remind you **${parsed.displayText}**`)
        .addFields(
            { name: 'Message', value: message, inline: false },
            { name: 'Reminder ID', value: `\`${event.eventId}\``, inline: true },
            { name: 'Delivery', value: sendDm ? 'DM' : 'This channel', inline: true },
        )
        .setTimestamp(parsed.date)
        .setFooter({ text: 'Reminder scheduled for' });

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });

    context.log.info('Reminder created', {
        eventId: event.eventId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        executeAt: parsed.date,
        sendDm,
    });
}

async function handleRemindChannel(interaction: any, context: Context) {
    const whenInput = interaction.options.getString('when');
    const message = interaction.options.getString('message');

    // Parse the time
    const parsed = parseTimeInput(whenInput);
    if (!parsed) {
        await interaction.reply({
            content: `Could not understand "${whenInput}". Try something like "in 2 hours" or "tomorrow at 3pm".`,
            ephemeral: true,
        });
        return;
    }

    // Validate future time
    if (!isFutureDate(parsed.date)) {
        await interaction.reply({
            content: 'Reminder time must be in the future.',
            ephemeral: true,
        });
        return;
    }

    // Check if scheduler service is available
    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    // Create the reminder payload
    const payload: ReminderPayload = {
        message,
        mentionUser: false,
        sendDm: false,
    };

    // Schedule the event
    const event = await context.schedulerService.scheduleEvent({
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        creatorId: interaction.user.id,
        eventType: 'reminder',
        payload,
        scheduleType: 'once',
        executeAt: parsed.date,
    });

    // Build confirmation embed
    const embed = new EmbedBuilder()
        .setColor(0x57F287)
        .setTitle('Channel Reminder Set')
        .setDescription(`Reminder will be posted **${parsed.displayText}**`)
        .addFields(
            { name: 'Message', value: message, inline: false },
            { name: 'Reminder ID', value: `\`${event.eventId}\``, inline: true },
            { name: 'Channel', value: `<#${interaction.channelId}>`, inline: true },
        )
        .setTimestamp(parsed.date)
        .setFooter({ text: 'Reminder scheduled for' });

    await interaction.reply({
        embeds: [embed],
    });

    context.log.info('Channel reminder created', {
        eventId: event.eventId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        channelId: interaction.channelId,
        executeAt: parsed.date,
    });
}

async function handleList(interaction: any, context: Context) {
    // Check if scheduler service is available
    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    // Get user's active reminders
    const reminders = await context.schedulerService.listEvents(interaction.guildId, {
        creatorId: interaction.user.id,
        eventType: 'reminder',
        status: 'active',
        limit: 25,
    });

    if (reminders.length === 0) {
        await interaction.reply({
            content: 'You have no active reminders.',
            ephemeral: true,
        });
        return;
    }

    // Build the list embed
    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Your Active Reminders')
        .setDescription(
            reminders.map((reminder: any, index: number) => {
                const payload = parsePayload<ReminderPayload>(reminder.payload);
                const preview = payload.message.length > 50
                    ? `${payload.message.substring(0, 47)}...`
                    : payload.message;
                const timeDisplay = reminder.executeAt
                    ? formatRelativeTime(new Date(reminder.executeAt))
                    : 'Unknown';
                const deliveryType = payload.sendDm ? '(DM)' : `<#${reminder.channelId}>`;

                return `**${index + 1}.** \`${reminder.eventId}\`\n` +
                    `"${preview}"\n` +
                    `${timeDisplay} • ${deliveryType}`;
            }).join('\n\n')
        )
        .setFooter({ text: 'Use /remind cancel to cancel a reminder' });

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

async function handleCancel(interaction: any, context: Context) {
    const reminderId = interaction.options.getString('reminder_id');

    // Check if scheduler service is available
    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    // Try to cancel the reminder (with user ownership check)
    const cancelled = await context.schedulerService.cancelEvent(reminderId, interaction.user.id);

    if (!cancelled) {
        await interaction.reply({
            content: 'Reminder not found or you do not have permission to cancel it.',
            ephemeral: true,
        });
        return;
    }

    await interaction.reply({
        content: `Reminder \`${reminderId}\` has been cancelled.`,
        ephemeral: true,
    });

    context.log.info('Reminder cancelled', {
        eventId: reminderId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
    });
}
