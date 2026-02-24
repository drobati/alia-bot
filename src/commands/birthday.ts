import { EmbedBuilder, SlashCommandBuilder } from "discord.js";
import { Context } from "../types";
import { BirthdayPayload, parsePayload } from "../models/scheduledEvent";
import { birthdayToCron } from "../services/eventHandlers/birthdayHandler";

export const BIRTHDAY_CHANNEL_CONFIG_KEY = (guildId: string) => `birthday_channel_${guildId}`;

export default {
    data: new SlashCommandBuilder()
        .setName('birthday')
        .setDescription('Register your birthday for automatic celebrations')
        .addSubcommand(subcommand =>
            subcommand
                .setName('set')
                .setDescription('Register your birthday')
                .addStringOption(option =>
                    option.setName('date')
                        .setDescription('Your birthday in MM-DD format (e.g., 03-15)')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove your registered birthday'))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List all registered birthdays in this server')),

    async execute(interaction: any, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'set':
                    await handleSet(interaction, context);
                    break;
                case 'remove':
                    await handleRemove(interaction, context);
                    break;
                case 'list':
                    await handleList(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            context.log.error('Error executing birthday command', { error, subcommand, userId: interaction.user.id });
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
};

async function handleSet(interaction: any, context: Context) {
    const dateInput = interaction.options.getString('date');

    // Validate MM-DD format
    const dateMatch = dateInput.match(/^(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/);
    if (!dateMatch) {
        await interaction.reply({
            content: 'Invalid date format. Use MM-DD (e.g., 03-15 for March 15th).',
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

    // Check for duplicate — user can only have one birthday registered
    const existing = await context.schedulerService.listEvents(interaction.guildId, {
        eventType: 'birthday',
        status: 'active',
        limit: 50,
    });

    const duplicate = existing.find((event: any) => {
        const payload = parsePayload<BirthdayPayload>(event.payload);
        return payload.userId === interaction.user.id;
    });

    if (duplicate) {
        await interaction.reply({
            content: 'You already have a birthday registered. Remove it first with `/birthday remove`.',
            ephemeral: true,
        });
        return;
    }

    const payload: BirthdayPayload = {
        userId: interaction.user.id,
        username: interaction.user.displayName || interaction.user.username,
        birthDate: dateInput,
    };

    const cronSchedule = birthdayToCron(dateInput);

    // Calculate the next occurrence for executeAt
    const [month, day] = dateInput.split('-');
    const now = new Date();
    let nextBirthday = new Date(now.getFullYear(), parseInt(month, 10) - 1, parseInt(day, 10), 9, 0, 0);
    if (nextBirthday <= now) {
        nextBirthday = new Date(now.getFullYear() + 1, parseInt(month, 10) - 1, parseInt(day, 10), 9, 0, 0);
    }

    const event = await context.schedulerService.scheduleEvent({
        guildId: interaction.guildId,
        channelId: null, // Channel is determined by config at execution time
        creatorId: interaction.user.id,
        eventType: 'birthday',
        payload,
        scheduleType: 'cron',
        executeAt: nextBirthday,
        cronSchedule,
    });

    const monthNames = [
        'January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December',
    ];
    const displayDate = `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;

    // Check if a birthday channel is configured
    const configKey = BIRTHDAY_CHANNEL_CONFIG_KEY(interaction.guildId);
    const config = await context.tables.Config.findOne({ where: { key: configKey } });
    const channelNote = config?.value
        ? `Announcements will be posted in <#${config.value}>`
        : 'No birthday channel configured yet. An admin can set one with `/config birthday channel`.';

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('\u{1F382} Birthday Registered!')
        .setDescription(`Your birthday has been registered.`)
        .addFields(
            { name: 'Date', value: displayDate, inline: true },
            { name: 'Event ID', value: `\`${event.eventId}\``, inline: true },
        )
        .setFooter({ text: channelNote });

    await interaction.reply({ embeds: [embed], ephemeral: true });

    context.log.info('Birthday registered', {
        eventId: event.eventId,
        userId: interaction.user.id,
        birthDate: dateInput,
        guildId: interaction.guildId,
    });
}

async function handleRemove(interaction: any, context: Context) {
    if (!context.schedulerService) {
        await interaction.reply({
            content: 'Scheduler service is not available. Please try again later.',
            ephemeral: true,
        });
        return;
    }

    // Find the calling user's birthday
    const existing = await context.schedulerService.listEvents(interaction.guildId, {
        eventType: 'birthday',
        status: 'active',
        limit: 50,
    });

    const myBirthday = existing.find((event: any) => {
        const payload = parsePayload<BirthdayPayload>(event.payload);
        return payload.userId === interaction.user.id;
    });

    if (!myBirthday) {
        await interaction.reply({
            content: 'You don\'t have a birthday registered.',
            ephemeral: true,
        });
        return;
    }

    const cancelled = await context.schedulerService.cancelEvent(myBirthday.eventId);

    if (!cancelled) {
        await interaction.reply({
            content: 'Failed to remove your birthday. Please try again.',
            ephemeral: true,
        });
        return;
    }

    const payload = parsePayload<BirthdayPayload>(myBirthday.payload);

    await interaction.reply({
        content: `Removed your birthday (${payload.birthDate}).`,
        ephemeral: true,
    });

    context.log.info('Birthday removed', {
        eventId: myBirthday.eventId,
        userId: interaction.user.id,
        guildId: interaction.guildId,
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

    const birthdays = await context.schedulerService.listEvents(interaction.guildId, {
        eventType: 'birthday',
        status: 'active',
        limit: 50,
    });

    if (birthdays.length === 0) {
        await interaction.reply({
            content: 'No birthdays registered in this server.',
            ephemeral: true,
        });
        return;
    }

    const monthNames = [
        'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
        'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec',
    ];

    // Sort by month-day
    const sorted = [...birthdays].sort((a: any, b: any) => {
        const payloadA = parsePayload<BirthdayPayload>(a.payload);
        const payloadB = parsePayload<BirthdayPayload>(b.payload);
        return payloadA.birthDate.localeCompare(payloadB.birthDate);
    });

    const embed = new EmbedBuilder()
        .setColor(0xFFD700)
        .setTitle('\u{1F382} Registered Birthdays')
        .setDescription(
            sorted.map((birthday: any, index: number) => {
                const payload = parsePayload<BirthdayPayload>(birthday.payload);
                const [month, day] = payload.birthDate.split('-');
                const displayDate = `${monthNames[parseInt(month, 10) - 1]} ${parseInt(day, 10)}`;
                return `**${index + 1}.** <@${payload.userId}> — ${displayDate}`;
            }).join('\n'),
        )
        .setFooter({ text: `${sorted.length} birthday${sorted.length !== 1 ? 's' : ''} registered` });

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}
