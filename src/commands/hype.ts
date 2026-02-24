import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Context } from "../types";
import { parseTimeInput, isFutureDate, formatRelativeTime } from "../utils/timeParser";
import { HypePayload, parsePayload, generateEventId } from "../models/scheduledEvent";
import { parseHypeInterval, DEFAULT_HYPE_INTERVALS } from "../services/eventHandlers/hypeHandler";

export default {
    data: new SlashCommandBuilder()
        .setName('hype')
        .setDescription('Build hype with countdown announcements for upcoming events')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a new hype event with countdown announcements')
                .addStringOption(option =>
                    option.setName('name')
                        .setDescription('Name of the event')
                        .setRequired(true)
                        .setMaxLength(100))
                .addStringOption(option =>
                    option.setName('when')
                        .setDescription('When the event starts (e.g., "next friday at 8pm")')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('description')
                        .setDescription('Optional event description')
                        .setRequired(false)
                        .setMaxLength(500))
                .addStringOption(option =>
                    option.setName('intervals')
                        // eslint-disable-next-line max-len
                        .setDescription('Announcement intervals (comma-separated, e.g., "24h,1h,15m,now"). Default: 24h,1h,15m,now')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List active hype events'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('cancel')
                .setDescription('Cancel a hype event and all its announcements')
                .addStringOption(option =>
                    option.setName('hype_id')
                        .setDescription('The hype group ID')
                        .setRequired(true)
                        .setAutocomplete(true))),

    async execute(interaction: any, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'create':
                    await handleCreate(interaction, context);
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
            context.log.error('Error executing hype command', { error, subcommand, userId: interaction.user.id });
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

        if (focusedOption.name === 'hype_id') {
            if (!context.schedulerService) {
                await interaction.respond([]);
                return;
            }

            const hypeEvents = await context.schedulerService.listEvents(interaction.guildId, {
                creatorId: interaction.user.id,
                eventType: 'hype',
                status: 'active',
                limit: 25,
            });

            // Group by hypeGroupId and show unique groups
            const groups = new Map<string, string>();
            for (const event of hypeEvents) {
                const payload = parsePayload<HypePayload>(event.payload);
                if (!groups.has(payload.hypeGroupId)) {
                    groups.set(payload.hypeGroupId, payload.eventName);
                }
            }

            const choices = Array.from(groups.entries()).map(([groupId, name]) => {
                const preview = name.length > 40
                    ? `${name.substring(0, 37)}...`
                    : name;
                return {
                    name: `${groupId}: ${preview}`,
                    value: groupId,
                };
            });

            await interaction.respond(choices);
        }
    },
};

async function handleCreate(interaction: any, context: Context) {
    const name = interaction.options.getString('name');
    const whenInput = interaction.options.getString('when');
    const description = interaction.options.getString('description') ?? undefined;
    const intervalsInput = interaction.options.getString('intervals');

    // Parse time
    const parsed = parseTimeInput(whenInput);
    if (!parsed) {
        await interaction.reply({
            content: `Could not understand "${whenInput}". Try something like "next friday at 8pm" or "in 3 days".`,
            ephemeral: true,
        });
        return;
    }

    if (!isFutureDate(parsed.date)) {
        await interaction.reply({
            content: 'Event time must be in the future.',
            ephemeral: true,
        });
        return;
    }

    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    // Parse intervals
    const intervals = intervalsInput
        ? intervalsInput.split(',').map((s: string) => s.trim().toLowerCase())
        : DEFAULT_HYPE_INTERVALS;

    // Validate all intervals
    for (const interval of intervals) {
        if (parseHypeInterval(interval) === null) {
            await interaction.reply({
                content: `Invalid interval "${interval}". Use formats like "24h", "1h", "15m", or "now".`,
                ephemeral: true,
            });
            return;
        }
    }

    const eventTime = parsed.date;
    const hypeGroupId = generateEventId();
    const now = new Date();
    let scheduledCount = 0;

    // Create one scheduled event per announcement interval
    for (const interval of intervals) {
        const intervalMs = parseHypeInterval(interval)!;
        const announceAt = new Date(eventTime.getTime() - intervalMs);

        // Skip announcements that are already in the past
        if (announceAt <= now) {
            continue;
        }

        const payload: HypePayload = {
            eventName: name,
            description,
            showCountdown: true,
            announceAt: intervals,
            eventTime: eventTime.toISOString(),
            announcementTier: interval,
            hypeGroupId,
        };

        await context.schedulerService.scheduleEvent({
            guildId: interaction.guildId,
            channelId: interaction.channelId,
            creatorId: interaction.user.id,
            eventType: 'hype',
            payload,
            scheduleType: 'once',
            executeAt: announceAt,
        });

        scheduledCount++;
    }

    if (scheduledCount === 0) {
        await interaction.reply({
            content: 'All announcement times are in the past. '
                + 'Try an event further in the future or use shorter intervals.',
            ephemeral: true,
        });
        return;
    }

    // Build confirmation embed
    const scheduledIntervals = intervals.filter((interval: string) => {
        const intervalMs = parseHypeInterval(interval)!;
        const announceAt = new Date(eventTime.getTime() - intervalMs);
        return announceAt > now;
    });

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Hype Event Created')
        .setDescription(`**${name}** is happening **${parsed.displayText}**!`)
        .addFields(
            { name: 'Hype ID', value: `\`${hypeGroupId}\``, inline: true },
            { name: 'Announcements', value: `${scheduledCount} scheduled`, inline: true },
            { name: 'Intervals', value: scheduledIntervals.join(', '), inline: true },
        )
        .setTimestamp(eventTime)
        .setFooter({ text: 'Event scheduled for' });

    if (description) {
        embed.spliceFields(0, 0, { name: 'Description', value: description, inline: false });
    }

    await interaction.reply({
        embeds: [embed],
    });

    context.log.info('Hype event created', {
        hypeGroupId,
        eventName: name,
        userId: interaction.user.id,
        guildId: interaction.guildId,
        scheduledCount,
        intervals: scheduledIntervals,
    });
}

async function handleList(interaction: any, context: Context) {
    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    const hypeEvents = await context.schedulerService.listEvents(interaction.guildId, {
        eventType: 'hype',
        status: 'active',
        limit: 50,
    });

    if (hypeEvents.length === 0) {
        await interaction.reply({
            content: 'No active hype events.',
            ephemeral: true,
        });
        return;
    }

    // Group by hypeGroupId
    const groups = new Map<string, {
        name: string;
        description?: string;
        eventTime: Date;
        announcements: number;
        creatorId: string;
        hypeGroupId: string;
    }>();

    for (const event of hypeEvents) {
        const payload = parsePayload<HypePayload>(event.payload);
        const groupId = payload.hypeGroupId;
        if (!groups.has(groupId)) {
            groups.set(groupId, {
                name: payload.eventName,
                description: payload.description,
                eventTime: new Date(payload.eventTime),
                announcements: 0,
                creatorId: event.creatorId,
                hypeGroupId: groupId,
            });
        }
        groups.get(groupId)!.announcements++;
    }

    const embed = new EmbedBuilder()
        .setColor(0x5865F2)
        .setTitle('Active Hype Events')
        .setDescription(
            Array.from(groups.values()).map((group, index) => {
                const timeDisplay = formatRelativeTime(group.eventTime);
                const countText = group.announcements !== 1 ? 's' : '';
                return `**${index + 1}.** \`${group.hypeGroupId}\` — ` +
                    `**${group.name}**\n` +
                    `${timeDisplay} • ${group.announcements} announcement` +
                    `${countText} remaining • <@${group.creatorId}>`;
            }).join('\n\n'),
        )
        .setFooter({ text: 'Use /hype cancel to cancel a hype event' });

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

async function handleCancel(interaction: any, context: Context) {
    const hypeId = interaction.options.getString('hype_id');

    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    // Find all events in this hype group
    const allHypeEvents = await context.schedulerService.listEvents(interaction.guildId, {
        eventType: 'hype',
        status: 'active',
        limit: 50,
    });

    const groupEvents = allHypeEvents.filter((event: any) => {
        const payload = parsePayload<HypePayload>(event.payload);
        return payload.hypeGroupId === hypeId;
    });

    if (groupEvents.length === 0) {
        await interaction.reply({
            content: 'Hype event not found or already cancelled.',
            ephemeral: true,
        });
        return;
    }

    // Check ownership
    const isOwner = groupEvents[0].creatorId === interaction.user.id;
    if (!isOwner) {
        await interaction.reply({
            content: 'You can only cancel hype events you created.',
            ephemeral: true,
        });
        return;
    }

    // Cancel all events in the group
    let cancelledCount = 0;
    for (const event of groupEvents) {
        const cancelled = await context.schedulerService.cancelEvent(event.eventId);
        if (cancelled) {
            cancelledCount++;
        }
    }

    const payload = parsePayload<HypePayload>(groupEvents[0].payload);

    const countText = cancelledCount !== 1 ? 's' : '';
    await interaction.reply({
        content: `Cancelled hype event **${payload.eventName}** (\`${hypeId}\`) `
            + `— ${cancelledCount} announcement${countText} removed.`,
        ephemeral: true,
    });

    context.log.info('Hype event cancelled', {
        hypeGroupId: hypeId,
        userId: interaction.user.id,
        cancelledCount,
    });
}
