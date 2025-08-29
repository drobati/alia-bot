import { SlashCommandBuilder, ChannelType, PermissionFlagsBits } from "discord.js";
import { Context } from "../utils/types";

function validateCronSchedule(schedule: string): boolean {
    const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|[12]\d|3[01])) (\*|([01]?\d)) (\*|[0-6])$/;
    return cronRegex.test(schedule);
}

function getDefaultCronSchedule(frequency: string): string {
    switch (frequency) {
        case 'daily':
            return '0 9 * * *'; // 9 AM daily
        case 'weekly':
            return '0 9 * * 1'; // 9 AM every Monday
        default:
            return '0 9 * * *';
    }
}

async function handleSetupCommand(interaction: any, context: Context) {
    const channel = interaction.options.getChannel('channel');
    const frequency = interaction.options.getString('frequency');
    const category = interaction.options.getString('category');
    const schedule = interaction.options.getString('schedule') || getDefaultCronSchedule(frequency);

    if (!channel) {
        throw new Error('Channel is required for setup.');
    }

    if (channel.type !== ChannelType.GuildText) {
        throw new Error('Only text channels are supported for motivational messages.');
    }

    if (!validateCronSchedule(schedule)) {
        throw new Error(
            'Invalid cron schedule format. Use format: "minute hour day month dayOfWeek" (e.g., "0 9 * * *").',
        );
    }

    const result = await context.sequelize.transaction(async (transaction: any) => {
        const [config, created] = await context.tables.MotivationalConfig.upsert({
            channelId: channel.id,
            guildId: interaction.guildId,
            frequency,
            category,
            cronSchedule: schedule,
            isActive: true,
        }, { transaction });
        return { config, created };
    });

    // Update the scheduler with the new/updated configuration
    if (context.motivationalScheduler) {
        try {
            await context.motivationalScheduler.updateSchedule(channel.id);
            context.log.info('Scheduler updated for channel', { channelId: channel.id });
        } catch (schedulerError) {
            context.log.error('Failed to update scheduler', { channelId: channel.id, error: schedulerError });
        }
    }

    const action = result.created ? 'configured' : 'updated';
    const freqText = frequency === 'daily' ? 'daily' : 'weekly (Mondays)';

    await interaction.reply({
        content: `✅ Motivational messages ${action} for ${channel}!\n` +
                `• **Frequency**: ${freqText}\n` +
                `• **Category**: ${category}\n` +
                `• **Schedule**: ${schedule}\n` +
                `• **Status**: Active`,
        ephemeral: true,
    });
}

async function handleDisableCommand(interaction: any, context: Context) {
    const channel = interaction.options.getChannel('channel');

    if (!channel) {
        throw new Error('Channel is required to disable motivational messages.');
    }

    await context.sequelize.transaction(async (transaction: any) => {
        const config = await context.tables.MotivationalConfig.findOne({
            where: { channelId: channel.id },
            transaction,
        });

        if (!config) {
            throw new Error(`No motivational message configuration found for ${channel}.`);
        }

        await config.update({ isActive: false }, { transaction });
    });

    // Remove from scheduler
    if (context.motivationalScheduler) {
        try {
            await context.motivationalScheduler.removeSchedule(channel.id);
            context.log.info('Scheduler removed for channel', { channelId: channel.id });
        } catch (schedulerError) {
            context.log.error('Failed to remove from scheduler', { channelId: channel.id, error: schedulerError });
        }
    }

    await interaction.reply({
        content: `❌ Motivational messages disabled for ${channel}.`,
        ephemeral: true,
    });
}

async function handleEnableCommand(interaction: any, context: Context) {
    const channel = interaction.options.getChannel('channel');

    if (!channel) {
        throw new Error('Channel is required to enable motivational messages.');
    }

    await context.sequelize.transaction(async (transaction: any) => {
        const config = await context.tables.MotivationalConfig.findOne({
            where: { channelId: channel.id },
            transaction,
        });

        if (!config) {
            throw new Error(
                `No motivational message configuration found for ${channel}. Use \`/motivational-config setup\` first.`,
            );
        }

        await config.update({ isActive: true }, { transaction });
    });

    // Add to scheduler
    if (context.motivationalScheduler) {
        try {
            await context.motivationalScheduler.updateSchedule(channel.id);
            context.log.info('Scheduler updated for channel', { channelId: channel.id });
        } catch (schedulerError) {
            context.log.error('Failed to update scheduler', { channelId: channel.id, error: schedulerError });
        }
    }

    await interaction.reply({
        content: `✅ Motivational messages enabled for ${channel}.`,
        ephemeral: true,
    });
}

async function handleStatusCommand(interaction: any, context: Context) {
    try {
        context.log.info('Status command called', {
            guildId: interaction.guildId,
            userId: interaction.user?.id,
            hasMotivationalConfig: !!context.tables.MotivationalConfig,
        });

        // Simple immediate response to test basic functionality
        await interaction.reply({
            content: '📊 Status command received and processing...',
            flags: 64, // MessageFlags.Ephemeral
        });

        // Check if the table/model exists
        if (!context.tables.MotivationalConfig) {
            await interaction.editReply({
                content: '❌ MotivationalConfig model not available. Please check bot setup.',
            });
            return;
        }

        // Test database connection with simple query
        const configs = await context.tables.MotivationalConfig.findAll({
            where: { guildId: interaction.guildId },
        });

        context.log.info('Database query successful', {
            count: configs.length,
            guildId: interaction.guildId,
        });

        const resultMessage = configs.length === 0
            ? '📊 No motivational message configurations found for this server.'
            : `📊 Found ${configs.length} configuration(s) for this server.`;

        await interaction.editReply({
            content: resultMessage,
        });

    } catch (error: any) {
        context.log.error('Error in status command', {
            error: error?.message || 'Unknown error',
            stack: error?.stack,
            guildId: interaction.guildId,
            errorName: error?.constructor?.name,
        });

        const errorMsg = `❌ Error: ${error?.message || 'Unknown error occurred'}`;

        try {
            if (!interaction.replied) {
                await interaction.reply({
                    content: errorMsg,
                    ephemeral: true,
                });
            } else {
                await interaction.editReply({
                    content: errorMsg,
                });
            }
        } catch (replyError: any) {
            context.log.error('Failed to send error response', {
                replyError: replyError?.message,
                originalError: error?.message,
            });
        }
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('motivational-config')
        .setDescription('Configure automated motivational messages for channels.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageChannels)
        .addSubcommand(subcommand =>
            subcommand
                .setName('setup')
                .setDescription('Set up motivational messages for a channel.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to send motivational messages to.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('frequency')
                        .setDescription('How often to send messages.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Daily', value: 'daily' },
                            { name: 'Weekly', value: 'weekly' },
                        ))
                .addStringOption(option =>
                    option
                        .setName('category')
                        .setDescription('Type of motivational messages.')
                        .setRequired(true)
                        .addChoices(
                            { name: 'Motivation', value: 'motivation' },
                            { name: 'Productivity', value: 'productivity' },
                            { name: 'General', value: 'general' },
                        ))
                .addStringOption(option =>
                    option
                        .setName('schedule')
                        .setDescription('Custom cron schedule (e.g., "0 9 * * *" for 9 AM daily). Optional.')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('disable')
                .setDescription('Disable motivational messages for a channel.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to disable messages for.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('enable')
                .setDescription('Enable motivational messages for a channel.')
                .addChannelOption(option =>
                    option
                        .setName('channel')
                        .setDescription('The channel to enable messages for.')
                        .addChannelTypes(ChannelType.GuildText)
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('status')
                .setDescription('View status of all motivational message configurations.')),

    async execute(interaction: any, context: Context) {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'setup':
                    await handleSetupCommand(interaction, context);
                    break;
                case 'disable':
                    await handleDisableCommand(interaction, context);
                    break;
                case 'enable':
                    await handleEnableCommand(interaction, context);
                    break;
                case 'status':
                    await handleStatusCommand(interaction, context);
                    break;
                default:
                    throw new Error(`Unknown subcommand: ${subcommand}`);
            }
        } catch (error) {
            log.error('Error executing motivational-config command:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred.';

            try {
                if (!interaction.replied && !interaction.deferred) {
                    await interaction.reply({ content: `❌ Error: ${errorMessage}`, ephemeral: true });
                } else if (interaction.deferred || interaction.replied) {
                    await interaction.editReply({ content: `❌ Error: ${errorMessage}` });
                }
            } catch (replyError) {
                log.error('Failed to send error response in main execute:', replyError);
            }
        }
    },
};