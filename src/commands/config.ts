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

const MAX_WELCOME_MESSAGE_LENGTH = 2000;

// Duration parsing helper
function parseDuration(duration: string): number | null {
    const match = duration.match(/^(\d+)(h|d|w)$/i);
    if (!match) {return null;}

    const value = parseInt(match[1], 10);
    const unit = match[2].toLowerCase();

    switch (unit) {
        case 'h': return value * 3600;
        case 'd': return value * 86400;
        case 'w': return value * 604800;
        default: return null;
    }
}

function formatDuration(seconds: number): string {
    if (seconds >= 604800 && seconds % 604800 === 0) {
        return `${seconds / 604800} week(s)`;
    } else if (seconds >= 86400 && seconds % 86400 === 0) {
        return `${seconds / 86400} day(s)`;
    } else {
        return `${seconds / 3600} hour(s)`;
    }
}

// Handler functions
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

async function handleVerifyExpiration(interaction: ChatInputCommandInteraction, context: Context) {
    const duration = interaction.options.getString('duration', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const seconds = parseDuration(duration);
    if (seconds === null) {
        return interaction.reply({
            content: "Invalid duration format. Use format like `24h`, `7d`, or `2w` (hours, days, weeks).",
            ephemeral: true,
        });
    }

    const key = `verify_expiration_${guildId}`;
    await context.tables.Config.upsert({ key, value: seconds.toString() });

    await interaction.reply({
        content: `Verification code expiration set to ${formatDuration(seconds)}.`,
        ephemeral: true,
    });
}

async function handleVerifyAllowedRoles(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    // Get all role options (up to 5 roles supported)
    const roles: string[] = [];
    for (let i = 1; i <= 5; i++) {
        const role = interaction.options.getRole(`role${i}`);
        if (role) {
            roles.push(role.id);
        }
    }

    if (roles.length === 0) {
        return interaction.reply({
            content: "Please specify at least one role.",
            ephemeral: true,
        });
    }

    const key = `verify_allowed_roles_${guildId}`;
    await context.tables.Config.upsert({ key, value: JSON.stringify(roles) });

    const roleNames = roles.map(id => `<@&${id}>`).join(', ');
    await interaction.reply({
        content: `Verification allowed roles set to: ${roleNames}`,
        ephemeral: true,
    });
}

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
    const config = await context.tables.Config.findOne({ where: { key } });

    if (!config?.value) {
        return interaction.reply({
            content: "No log channel is configured for this server.\n"
                + "Use `/config logs channel` to set one.",
            ephemeral: true,
        });
    }

    // Verify the channel exists
    const guild = interaction.guild;
    const channel = guild?.channels.cache.get(config.value);

    if (!channel) {
        return interaction.reply({
            content: `⚠️ **Warning**: Log channel is configured to ID \`${config.value}\`, `
                + `but this channel no longer exists.\n`
                + `Use \`/config logs channel\` to set a valid channel.`,
            ephemeral: true,
        });
    }

    await interaction.reply({
        content: `**Current Log Settings**\n`
            + `📋 Log Channel: <#${config.value}> (\`${config.value}\`)\n`
            + `✅ Channel exists and is accessible`,
        ephemeral: true,
    });
}

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
                    .setDescription('The channel for welcome messages and verification codes.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('message')
                .setDescription('Set the welcome message.')
                .addStringOption((option: any) => option
                    .setName('message')
                    .setDescription('The welcome message. Use {user}, {server}, {memberCount} as placeholders.')
                    .setRequired(true))))
        // Verify subcommand group
        .addSubcommandGroup((group: any) => group
            .setName('verify')
            .setDescription('Verification code settings.')
            .addSubcommand((subcommand: any) => subcommand
                .setName('expiration')
                .setDescription('Set how long verification codes are valid.')
                .addStringOption((option: any) => option
                    .setName('duration')
                    .setDescription('Duration (e.g., 24h, 7d, 2w)')
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('allowed-roles')
                .setDescription('Set which roles can be granted via verification codes.')
                .addRoleOption((option: any) => option
                    .setName('role1')
                    .setDescription('First role to allow.')
                    .setRequired(true))
                .addRoleOption((option: any) => option
                    .setName('role2')
                    .setDescription('Second role to allow.')
                    .setRequired(false))
                .addRoleOption((option: any) => option
                    .setName('role3')
                    .setDescription('Third role to allow.')
                    .setRequired(false))
                .addRoleOption((option: any) => option
                    .setName('role4')
                    .setDescription('Fourth role to allow.')
                    .setRequired(false))
                .addRoleOption((option: any) => option
                    .setName('role5')
                    .setDescription('Fifth role to allow.')
                    .setRequired(false))))
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
                .setDescription('Set the bot log channel for all events (member joins, verification, etc).')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel to log bot events.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('show')
                .setDescription('Show current log channel configuration.'))),

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
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log } = context;
        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

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

                case 'verify':
                    if (subcommand === 'expiration') {
                        await handleVerifyExpiration(interaction, context);
                    } else if (subcommand === 'allowed-roles') {
                        await handleVerifyAllowedRoles(interaction, context);
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

            log.error('Error executing config command:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await interaction.reply({
                content: `An error occurred: ${errorMessage}`,
                ephemeral: true,
            });
        }
    },
};
