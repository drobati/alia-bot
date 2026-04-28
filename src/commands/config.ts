import { isEmpty } from "lodash";
import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
    ChannelType,
    PermissionFlagsBits,
} from "discord.js";
import { Op } from "sequelize";
import { Context } from "../types";
import { checkOwnerPermission, isOwner } from "../utils/permissions";
import { Sentry } from "../lib/sentry";
import { TTS_CONFIG } from "../utils/constants";

const MAX_WELCOME_MESSAGE_LENGTH = 2000;

// Motivational helpers
function validateCronSchedule(schedule: string): boolean {
    const cronRegex = /^(\*|([0-5]?\d)) (\*|([01]?\d|2[0-3])) (\*|([01]?\d|[12]\d|3[01])) (\*|([01]?\d)) (\*|[0-6])$/;
    return cronRegex.test(schedule);
}

function getDefaultCronSchedule(frequency: string): string {
    switch (frequency) {
        case 'daily':
            return '0 9 * * *';
        case 'weekly':
            return '0 9 * * 1';
        default:
            return '0 9 * * *';
    }
}

// Server (security/spam shield) handlers
async function handleServerSecurityEnable(
    interaction: ChatInputCommandInteraction, context: Context,
) {
    const guildId = interaction.guildId;
    if (!guildId) {
        return interaction.reply({
            content: "This command can only be used in a server.", ephemeral: true,
        });
    }
    const enabled = interaction.options.getBoolean('enabled', true);
    await context.tables.Config.upsert({
        key: `security_enabled_${guildId}`,
        value: enabled ? 'true' : 'false',
    });
    await interaction.reply({
        content: `Spam shield is now **${enabled ? 'enabled' : 'disabled'}**.`,
        ephemeral: true,
    });
}

async function handleServerSecurityDryRun(
    interaction: ChatInputCommandInteraction, context: Context,
) {
    const guildId = interaction.guildId;
    if (!guildId) {
        return interaction.reply({
            content: "This command can only be used in a server.", ephemeral: true,
        });
    }
    const enabled = interaction.options.getBoolean('enabled', true);
    await context.tables.Config.upsert({
        key: `security_dryrun_${guildId}`,
        value: enabled ? 'true' : 'false',
    });
    await interaction.reply({
        content: `Spam shield dry-run mode is now **${enabled ? 'on' : 'off'}**. ` +
            `When on, the shield logs incidents but does not strip roles or timeout.`,
        ephemeral: true,
    });
}

async function handleServerPurgatoryChannel(
    interaction: ChatInputCommandInteraction, context: Context,
) {
    const guildId = interaction.guildId;
    if (!guildId) {
        return interaction.reply({
            content: "This command can only be used in a server.", ephemeral: true,
        });
    }
    const channel = interaction.options.getChannel('channel', true);
    await context.tables.Config.upsert({
        key: `security_purgatory_channel_${guildId}`,
        value: channel.id,
    });
    await interaction.reply({
        content: `Purgatory channel set to <#${channel.id}>. ` +
            `Spam-shield warnings will be posted there.`,
        ephemeral: true,
    });
}

async function handleServerSecurityShow(
    interaction: ChatInputCommandInteraction, context: Context,
) {
    const guildId = interaction.guildId;
    if (!guildId) {
        return interaction.reply({
            content: "This command can only be used in a server.", ephemeral: true,
        });
    }
    const { Config } = context.tables;
    const [enabled, dryRun, purg] = await Promise.all([
        Config.findOne({ where: { key: `security_enabled_${guildId}` } }),
        Config.findOne({ where: { key: `security_dryrun_${guildId}` } }),
        Config.findOne({ where: { key: `security_purgatory_channel_${guildId}` } }),
    ]);
    const lines = [
        `**Spam shield**`,
        `- Enabled: ${enabled?.value === 'true' ? 'yes' : 'no'}`,
        `- Dry-run: ${dryRun?.value === 'true' ? 'yes' : 'no'}`,
        `- Purgatory channel: ${purg?.value ? `<#${purg.value}>` : '_not set_'}`,
    ];
    await interaction.reply({ content: lines.join('\n'), ephemeral: true });
}

// Birthday handlers
async function handleBirthdayChannel(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `birthday_channel_${guildId}`;
    await context.tables.Config.upsert({ key, value: channel.id });

    await interaction.reply({
        content: `Birthday announcement channel set to <#${channel.id}>.`,
        ephemeral: true,
    });
}

async function handleBirthdayShow(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `birthday_channel_${guildId}`;
    const config = await context.tables.Config.findOne({ where: { key } });

    if (!config?.value) {
        return interaction.reply({
            content: "No birthday channel is configured for this server.\n"
                + "Use `/config birthday channel` to set one.",
            ephemeral: true,
        });
    }

    const guild = interaction.guild;
    const channel = guild?.channels.cache.get(config.value);

    if (!channel) {
        return interaction.reply({
            content: `Warning: Birthday channel is configured to ID \`${config.value}\`, `
                + `but this channel no longer exists.\n`
                + `Use \`/config birthday channel\` to set a valid channel.`,
            ephemeral: true,
        });
    }

    await interaction.reply({
        content: `**Birthday Settings**\n`
            + `Announcement Channel: <#${config.value}>\n`
            + `Birthdays are announced at 9:00 AM on the registered date.`,
        ephemeral: true,
    });
}

// TTS constants
const TTS_CONFIG_KEYS = {
    DEFAULT_VOICE: 'tts_default_voice',
    STABILITY: 'tts_stability',
    MAX_LENGTH: 'tts_max_length',
    RATE_LIMIT_COOLDOWN: 'tts_rate_limit_cooldown',
    ALLOWED_USERS: 'tts_allowed_users',
    AUTO_JOIN: 'tts_auto_join',
};

// General handlers
async function handleGeneralAdd(interaction: ChatInputCommandInteraction, context: Context) {
    const key = interaction.options.getString('key', true);
    const value = interaction.options.getString('value', true);

    if (isEmpty(key) || isEmpty(value)) {
        throw new Error('Key and value are required for adding a config.');
    }

    const result = await context.sequelize.transaction(async (transaction: any) => {
        const [, created] = await context.tables.Config.upsert({ key, value }, { transaction });
        return created;
    });

    const replyMessage = result ?
        `Configuration for \`${key}\` has been added.` :
        `Configuration for \`${key}\` has been updated.`;
    await interaction.reply({ content: replyMessage, ephemeral: true });
}

async function handleGeneralRemove(interaction: ChatInputCommandInteraction, context: Context) {
    const key = interaction.options.getString('key', true);

    const record = await context.tables.Config.findOne({ where: { key } });
    if (!record) {
        throw new Error(`No configuration found for key \`${key}\`.`);
    }
    await record.destroy();

    await interaction.reply({ content: `Configuration for \`${key}\` has been removed.`, ephemeral: true });
}

// Welcome handlers
async function handleWelcomeChannel(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `welcome_channel_${guildId}`;
    await context.tables.Config.upsert({ key, value: channel.id });

    await interaction.reply({ content: `Welcome channel set to <#${channel.id}>.`, ephemeral: true });
}

async function handleWelcomeMessage(interaction: ChatInputCommandInteraction, context: Context) {
    const message = interaction.options.getString('message', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    if (message.length > MAX_WELCOME_MESSAGE_LENGTH) {
        return interaction.reply({
            content: `Welcome message must be ${MAX_WELCOME_MESSAGE_LENGTH} characters or less. `
                + `Your message is ${message.length} characters.`,
            ephemeral: true,
        });
    }

    const key = `welcome_message_${guildId}`;
    await context.tables.Config.upsert({ key, value: message });

    await interaction.reply({
        content: `Welcome message set to:\n\`\`\`\n${message}\n\`\`\`\n`
            + 'Supported placeholders: `{user}`, `{server}`, `{memberCount}`',
        ephemeral: true,
    });
}

// Log handlers
async function handleLogChannel(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `log_channel_${guildId}`;
    await context.tables.Config.upsert({ key, value: channel.id });

    await interaction.reply({
        content: `Bot log channel set to <#${channel.id}>. `
            + `Events like member joins, verification, and other bot activity will be logged there.`,
        ephemeral: true,
    });
}

async function handleLogShow(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `log_channel_${guildId}`;

    let config;
    try {
        config = await context.tables.Config.findOne({ where: { key } });
    } catch (dbError) {
        Sentry.captureException(dbError, {
            tags: { command: 'config', subcommand: 'logs show' },
            extra: { guildId, key },
        });
        context.log.error({ error: dbError, guildId }, 'Database error in handleLogShow');
        return interaction.reply({
            content: "Database error while looking up log channel configuration.",
            ephemeral: true,
        });
    }

    if (!config?.value) {
        return interaction.reply({
            content: "No log channel is configured for this server.\n"
                + "Use `/config logs channel` to set one.",
            ephemeral: true,
        });
    }

    const guild = interaction.guild;
    const channel = guild?.channels.cache.get(config.value);

    if (!channel) {
        return interaction.reply({
            content: `Warning: Log channel is configured to ID \`${config.value}\`, `
                + `but this channel no longer exists.\n`
                + `Use \`/config logs channel\` to set a valid channel.`,
            ephemeral: true,
        });
    }

    await interaction.reply({
        content: `**Current Log Settings**\n`
            + `Log Channel: <#${config.value}> (\`${config.value}\`)\n`
            + `Channel exists and is accessible`,
        ephemeral: true,
    });
}

// Dice handlers
async function handleDiceMaxDice(interaction: ChatInputCommandInteraction, context: Context) {
    const maxDice = interaction.options.getInteger('limit', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `dice_max_dice_${guildId}`;
    await context.tables.Config.upsert({ key, value: maxDice.toString() });

    await interaction.reply({
        content: `Maximum dice per roll set to **${maxDice}**.`,
        ephemeral: true,
    });
}

async function handleDiceShowThreshold(interaction: ChatInputCommandInteraction, context: Context) {
    const threshold = interaction.options.getInteger('threshold', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `dice_show_individual_${guildId}`;
    await context.tables.Config.upsert({ key, value: threshold.toString() });

    await interaction.reply({
        content: `Individual dice results will be shown for rolls with **${threshold}** or fewer dice.`,
        ephemeral: true,
    });
}

// Motivational handlers
async function handleMotivationalSetup(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);
    const frequency = interaction.options.getString('frequency', true);
    const category = interaction.options.getString('category', true);
    const schedule = interaction.options.getString('schedule') || getDefaultCronSchedule(frequency);

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

    if (context.motivationalScheduler) {
        try {
            await context.motivationalScheduler.updateSchedule(channel.id);
        } catch (schedulerError) {
            context.log.error('Failed to update scheduler', { channelId: channel.id, error: schedulerError });
        }
    }

    const action = result.created ? 'configured' : 'updated';
    const freqText = frequency === 'daily' ? 'daily' : 'weekly (Mondays)';

    await interaction.reply({
        content: `Motivational messages ${action} for ${channel}!\n` +
                `**Frequency**: ${freqText}\n` +
                `**Category**: ${category}\n` +
                `**Schedule**: ${schedule}\n` +
                `**Status**: Active`,
        ephemeral: true,
    });
}

async function handleMotivationalDisable(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);

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

    if (context.motivationalScheduler) {
        try {
            await context.motivationalScheduler.removeSchedule(channel.id);
        } catch (schedulerError) {
            context.log.error('Failed to remove from scheduler', { channelId: channel.id, error: schedulerError });
        }
    }

    await interaction.reply({
        content: `Motivational messages disabled for ${channel}.`,
        ephemeral: true,
    });
}

async function handleMotivationalEnable(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);

    await context.sequelize.transaction(async (transaction: any) => {
        const config = await context.tables.MotivationalConfig.findOne({
            where: { channelId: channel.id },
            transaction,
        });

        if (!config) {
            throw new Error(
                `No motivational message configuration found for ${channel}. Use \`/config motivational setup\` first.`,
            );
        }

        await config.update({ isActive: true }, { transaction });
    });

    if (context.motivationalScheduler) {
        try {
            await context.motivationalScheduler.updateSchedule(channel.id);
        } catch (schedulerError) {
            context.log.error('Failed to update scheduler', { channelId: channel.id, error: schedulerError });
        }
    }

    await interaction.reply({
        content: `Motivational messages enabled for ${channel}.`,
        ephemeral: true,
    });
}

async function handleMotivationalStatus(interaction: ChatInputCommandInteraction, context: Context) {
    await interaction.reply({
        content: 'Status command received and processing...',
        ephemeral: true,
    });

    if (!context.tables.MotivationalConfig) {
        await interaction.editReply({
            content: 'MotivationalConfig model not available. Please check bot setup.',
        });
        return;
    }

    const configs = await context.tables.MotivationalConfig.findAll({
        where: { guildId: interaction.guildId },
    });

    const resultMessage = configs.length === 0
        ? 'No motivational message configurations found for this server.'
        : `Found ${configs.length} configuration(s) for this server.`;

    await interaction.editReply({ content: resultMessage });
}

// TTS handlers
async function handleTtsShow(interaction: ChatInputCommandInteraction, context: Context) {
    const configs = await context.tables.Config.findAll({
        where: {
            key: Object.values(TTS_CONFIG_KEYS),
        },
    });

    const configMap = new Map(configs.map((config: any) => [config.key, config.value]));

    const defaultVoice = configMap.get(TTS_CONFIG_KEYS.DEFAULT_VOICE) || 'Df0A8fHl2LOO7kDNIlpg';
    const stabilityVal = configMap.get(TTS_CONFIG_KEYS.STABILITY) || '0.0';
    const stabilityLabels: Record<string, string> = {
        '0.0': 'Creative (most expressive)',
        '0.5': 'Natural (balanced)',
        '1.0': 'Robust (most stable)',
    };
    const stabilityLabel = stabilityLabels[stabilityVal] || stabilityVal;
    const maxLength = configMap.get(TTS_CONFIG_KEYS.MAX_LENGTH) || String(TTS_CONFIG.MAX_TEXT_LENGTH);
    const rateLimitCooldown = configMap.get(TTS_CONFIG_KEYS.RATE_LIMIT_COOLDOWN) || '5';

    const status = context.voiceService ?
        (context.voiceService.isConnectedToVoice(interaction.guild!.id) ? 'Connected' : 'Disconnected') :
        'Not initialized';

    const ttsChannelConfig = await context.tables.Config.findOne({
        where: { key: `tts_channel_${interaction.guildId}` },
    });
    const ttsChannel = ttsChannelConfig?.value
        ? `<#${ttsChannelConfig.value}>`
        : 'Not configured';

    const configText = [
        '**TTS Configuration**',
        '',
        `**Voice Status:** ${status}`,
        `**TTS Channel:** ${ttsChannel}`,
        `**Default Voice:** ${defaultVoice}`,
        `**Stability:** ${stabilityLabel}`,
        `**Max Text Length:** ${maxLength} characters`,
        `**Rate Limit Cooldown:** ${rateLimitCooldown} seconds`,
        '',
        '*Use `/config tts set-channel` to set the TTS input channel.*',
    ].join('\n');

    await interaction.reply({ content: configText, ephemeral: true });
}

async function handleTtsSetVoice(interaction: ChatInputCommandInteraction, context: Context) {
    const voice = interaction.options.getString('voice', true);

    await context.sequelize.transaction(async (transaction: any) => {
        await context.tables.Config.upsert(
            { key: TTS_CONFIG_KEYS.DEFAULT_VOICE, value: voice },
            { transaction },
        );
    });

    await interaction.reply({
        content: `Default TTS voice set to **${voice}**`,
        ephemeral: true,
    });
}

async function handleTtsSetStability(interaction: ChatInputCommandInteraction, context: Context) {
    const stability = interaction.options.getString('mode', true);

    await context.sequelize.transaction(async (transaction: any) => {
        await context.tables.Config.upsert(
            { key: TTS_CONFIG_KEYS.STABILITY, value: stability },
            { transaction },
        );
    });

    const labels: Record<string, string> = {
        '0.0': 'Creative (most expressive)',
        '0.5': 'Natural (balanced)',
        '1.0': 'Robust (most stable)',
    };

    await interaction.reply({
        content: `TTS stability set to **${labels[stability] || stability}**`,
        ephemeral: true,
    });
}

async function handleTtsSetMaxLength(interaction: ChatInputCommandInteraction, context: Context) {
    const maxLength = interaction.options.getInteger('max_length', true);

    if (maxLength < 1 || maxLength > TTS_CONFIG.MAX_TEXT_LENGTH) {
        await interaction.reply({
            content: `Max length must be between 1 and ${TTS_CONFIG.MAX_TEXT_LENGTH} characters.`,
            ephemeral: true,
        });
        return;
    }

    await context.sequelize.transaction(async (transaction: any) => {
        await context.tables.Config.upsert(
            { key: TTS_CONFIG_KEYS.MAX_LENGTH, value: maxLength.toString() },
            { transaction },
        );
    });

    await interaction.reply({
        content: `TTS max text length set to **${maxLength}** characters`,
        ephemeral: true,
    });
}

async function handleTtsReset(interaction: ChatInputCommandInteraction, context: Context) {
    await context.sequelize.transaction(async (transaction: any) => {
        await context.tables.Config.destroy({
            where: {
                key: Object.values(TTS_CONFIG_KEYS),
            },
            transaction,
        });
    });

    await interaction.reply({
        content: 'All TTS configuration has been reset to defaults.',
        ephemeral: true,
    });
}

async function handleTtsSetChannel(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const key = `tts_channel_${guildId}`;
    await context.tables.Config.upsert({ key, value: channel.id });

    await interaction.reply({
        content: `TTS channel set to <#${channel.id}>. ` +
            'Owner messages in that channel will be auto-spoken.',
        ephemeral: true,
    });
}

async function handleTtsClearChannel(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;

    if (!guildId) {
        await interaction.reply({ content: 'This command can only be used in a server.', ephemeral: true });
        return;
    }

    const key = `tts_channel_${guildId}`;
    await context.tables.Config.destroy({ where: { key } });

    await interaction.reply({
        content: 'TTS channel cleared. Auto-speak mode is disabled.',
        ephemeral: true,
    });
}

export default {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure bot settings.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        // General subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('general')
            .setDescription('General configuration settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('add')
                .setDescription('Add a configuration.')
                .addStringOption((option: any) => option
                    .setName('key')
                    .setDescription('The configuration key.')
                    .setRequired(true))
                .addStringOption((option: any) => option
                    .setName('value')
                    .setDescription('The configuration value.')
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('remove')
                .setDescription('Remove a configuration.')
                .addStringOption((option: any) => option
                    .setName('key')
                    .setDescription('The configuration key.')
                    .setAutocomplete(true)
                    .setRequired(true))))
        // Welcome subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('welcome')
            .setDescription('Welcome message settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('channel')
                .setDescription('Set the welcome channel.')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel for welcome messages.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('message')
                .setDescription('Set the welcome message.')
                .addStringOption((option: any) => option
                    .setName('message')
                    .setDescription('The welcome message. Use {user}, {server}, {memberCount} as placeholders.')
                    .setRequired(true))))
        // Dice subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('dice')
            .setDescription('Dice rolling settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('max-dice')
                .setDescription('Set maximum number of dice per roll.')
                .addIntegerOption((option: any) => option
                    .setName('limit')
                    .setDescription('Maximum dice allowed (default: 100)')
                    .setMinValue(1)
                    .setMaxValue(1000)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('show-threshold')
                .setDescription('Set when to show individual dice results.')
                .addIntegerOption((option: any) => option
                    .setName('threshold')
                    .setDescription('Show individual results for this many dice or fewer (default: 10)')
                    .setMinValue(1)
                    .setMaxValue(100)
                    .setRequired(true))))
        // Logs subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('logs')
            .setDescription('Bot logging settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('channel')
                .setDescription('Set the bot log channel for all events (member joins, etc).')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel to log bot events.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('show')
                .setDescription('Show current log channel configuration.')))
        // Motivational subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('motivational')
            .setDescription('Automated motivational message settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('setup')
                .setDescription('Set up motivational messages for a channel.')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel to send motivational messages to.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true))
                .addStringOption((option: any) => option
                    .setName('frequency')
                    .setDescription('How often to send messages.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Daily', value: 'daily' },
                        { name: 'Weekly', value: 'weekly' },
                    ))
                .addStringOption((option: any) => option
                    .setName('category')
                    .setDescription('Type of motivational messages.')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Motivation', value: 'motivation' },
                        { name: 'Productivity', value: 'productivity' },
                        { name: 'General', value: 'general' },
                    ))
                .addStringOption((option: any) => option
                    .setName('schedule')
                    .setDescription('Custom cron schedule (e.g., "0 9 * * *" for 9 AM daily). Optional.')
                    .setRequired(false)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('disable')
                .setDescription('Disable motivational messages for a channel.')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel to disable messages for.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('enable')
                .setDescription('Enable motivational messages for a channel.')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel to enable messages for.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('status')
                .setDescription('View status of all motivational message configurations.')))
        // Birthday subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('birthday')
            .setDescription('Birthday announcement settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('channel')
                .setDescription('Set the channel for birthday announcements.')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel to post birthday celebrations.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('show')
                .setDescription('Show current birthday channel configuration.')))
        // TTS subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('tts')
            .setDescription('Text-to-speech settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('show')
                .setDescription('Show current TTS configuration.'))
            .addSubcommand((subcommand: any) => subcommand
                .setName('set-voice')
                .setDescription('Set the default TTS voice.')
                .addStringOption((option: any) => option
                    .setName('voice')
                    .setDescription('Saved voice name or ElevenLabs voice ID')
                    .setRequired(true)
                    .setAutocomplete(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('set-stability')
                .setDescription('Set TTS voice stability/creativity mode.')
                .addStringOption((option: any) => option
                    .setName('mode')
                    .setDescription('Stability mode')
                    .setRequired(true)
                    .addChoices(
                        { name: 'Creative (most expressive)', value: '0.0' },
                        { name: 'Natural (balanced)', value: '0.5' },
                        { name: 'Robust (most stable)', value: '1.0' },
                    )))
            .addSubcommand((subcommand: any) => subcommand
                .setName('set-max-length')
                .setDescription('Set maximum text length for TTS.')
                .addIntegerOption((option: any) => option
                    .setName('max_length')
                    .setDescription(`Maximum characters (1-${TTS_CONFIG.MAX_TEXT_LENGTH})`)
                    .setRequired(true)
                    .setMinValue(1)
                    .setMaxValue(TTS_CONFIG.MAX_TEXT_LENGTH)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('reset')
                .setDescription('Reset all TTS configuration to defaults.'))
            .addSubcommand((subcommand: any) => subcommand
                .setName('set-channel')
                .setDescription('Set the text channel for TTS mode (messages are auto-spoken).')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The text channel to watch for TTS messages.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('clear-channel')
                .setDescription('Clear the TTS channel and disable auto-speak mode.')))
        // Server (security/spam shield) subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('server')
            .setDescription('Server-level security and spam-shield settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('shield-enable')
                .setDescription('Enable or disable the spam shield for this server.')
                .addBooleanOption((option: any) => option
                    .setName('enabled')
                    .setDescription('Whether the spam shield is active.')
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('shield-dryrun')
                .setDescription('Toggle dry-run mode (log only, no role/timeout actions).')
                .addBooleanOption((option: any) => option
                    .setName('enabled')
                    .setDescription('Whether dry-run mode is on.')
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('purgatory-channel')
                .setDescription('Set the channel where Alia posts spam-shield warnings.')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The purgatory channel.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('shield-show')
                .setDescription('Show current spam-shield configuration.'))),

    async autocomplete(interaction: AutocompleteInteraction, { tables }: Context) {
        // Only show autocomplete options to owner
        if (!isOwner(interaction.user.id)) {
            await interaction.respond([]);
            return;
        }

        const { Config } = tables;
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        if (subcommandGroup === 'general' && subcommand === 'remove') {
            const keyFragment = interaction.options.getFocused();
            const records = await Config.findAll({
                where: {
                    key: {
                        [Op.like]: `${keyFragment}%`,
                    },
                },
                limit: 25,
            });
            const choices = records.map((record: any) => ({
                name: record.key,
                value: record.key,
            }));
            await interaction.respond(choices);
        } else if (subcommandGroup === 'tts' && subcommand === 'set-voice') {
            const focused = interaction.options.getFocused();
            const voices = await tables.Voice.findAll({
                where: {
                    name: {
                        [Op.like]: `%${focused}%`,
                    },
                },
                limit: 25,
            });
            await interaction.respond(
                voices.map((v: any) => ({
                    name: `${v.name} - ${v.description}`,
                    value: v.voiceId,
                })),
            );
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log } = context;
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        log.info({
            subcommandGroup,
            subcommand,
            userId: interaction.user.id,
            guildId: interaction.guildId,
        }, 'Config command received');

        try {
            // Restrict config command to bot owner only
            await checkOwnerPermission(interaction, context);

            switch (subcommandGroup) {
                case 'general':
                    if (subcommand === 'add') {
                        await handleGeneralAdd(interaction, context);
                    } else if (subcommand === 'remove') {
                        await handleGeneralRemove(interaction, context);
                    }
                    break;

                case 'welcome':
                    if (subcommand === 'channel') {
                        await handleWelcomeChannel(interaction, context);
                    } else if (subcommand === 'message') {
                        await handleWelcomeMessage(interaction, context);
                    }
                    break;

                case 'dice':
                    if (subcommand === 'max-dice') {
                        await handleDiceMaxDice(interaction, context);
                    } else if (subcommand === 'show-threshold') {
                        await handleDiceShowThreshold(interaction, context);
                    }
                    break;

                case 'logs':
                    if (subcommand === 'channel') {
                        await handleLogChannel(interaction, context);
                    } else if (subcommand === 'show') {
                        await handleLogShow(interaction, context);
                    }
                    break;

                case 'motivational':
                    if (subcommand === 'setup') {
                        await handleMotivationalSetup(interaction, context);
                    } else if (subcommand === 'disable') {
                        await handleMotivationalDisable(interaction, context);
                    } else if (subcommand === 'enable') {
                        await handleMotivationalEnable(interaction, context);
                    } else if (subcommand === 'status') {
                        await handleMotivationalStatus(interaction, context);
                    }
                    break;

                case 'birthday':
                    if (subcommand === 'channel') {
                        await handleBirthdayChannel(interaction, context);
                    } else if (subcommand === 'show') {
                        await handleBirthdayShow(interaction, context);
                    }
                    break;

                case 'server':
                    if (subcommand === 'shield-enable') {
                        await handleServerSecurityEnable(interaction, context);
                    } else if (subcommand === 'shield-dryrun') {
                        await handleServerSecurityDryRun(interaction, context);
                    } else if (subcommand === 'purgatory-channel') {
                        await handleServerPurgatoryChannel(interaction, context);
                    } else if (subcommand === 'shield-show') {
                        await handleServerSecurityShow(interaction, context);
                    }
                    break;

                case 'tts':
                    if (subcommand === 'show') {
                        await handleTtsShow(interaction, context);
                    } else if (subcommand === 'set-voice') {
                        await handleTtsSetVoice(interaction, context);
                    } else if (subcommand === 'set-stability') {
                        await handleTtsSetStability(interaction, context);
                    } else if (subcommand === 'set-max-length') {
                        await handleTtsSetMaxLength(interaction, context);
                    } else if (subcommand === 'reset') {
                        await handleTtsReset(interaction, context);
                    } else if (subcommand === 'set-channel') {
                        await handleTtsSetChannel(interaction, context);
                    } else if (subcommand === 'clear-channel') {
                        await handleTtsClearChannel(interaction, context);
                    }
                    break;

                default:
                    await interaction.reply({
                        content: "Unknown command configuration.",
                        ephemeral: true,
                    });
            }
        } catch (error) {
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            if (error.message?.includes('Unauthorized')) {
                log.info('Unauthorized config command attempt', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                return; // Reply already sent in checkOwnerPermission
            }

            // Capture exception to Sentry with full context
            Sentry.captureException(error, {
                tags: {
                    command: 'config',
                    subcommandGroup: subcommandGroup || 'none',
                    subcommand,
                },
                extra: {
                    userId: interaction.user.id,
                    guildId: interaction.guildId,
                    interactionId: interaction.id,
                },
            });

            log.error({ error, subcommandGroup, subcommand }, 'Error executing config command');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({
                        content: `An error occurred: ${errorMessage}`,
                        ephemeral: true,
                    });
                } else {
                    await interaction.reply({
                        content: `An error occurred: ${errorMessage}`,
                        ephemeral: true,
                    });
                }
            } catch (replyError) {
                log.error({ error: replyError }, 'Failed to send error reply');
            }
        }
    },
};
