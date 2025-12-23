import { isEmpty } from "lodash";
import { SlashCommandBuilder, ChatInputCommandInteraction, AutocompleteInteraction, ChannelType } from "discord.js";
import { Op } from "sequelize";
import { Context } from "../types";

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

async function handleVerifyLogChannel(interaction: ChatInputCommandInteraction, context: Context) {
    const channel = interaction.options.getChannel('channel', true);
    const guildId = interaction.guildId;

    if (!guildId) {
        return interaction.reply({ content: "This command can only be used in a server.", ephemeral: true });
    }

    const key = `verify_log_channel_${guildId}`;
    await context.tables.Config.upsert({ key, value: channel.id });

    await interaction.reply({ content: `Verification log channel set to <#${channel.id}>.`, ephemeral: true });
}

export default {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Configure bot settings.')
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
                    .setRequired(false)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('log-channel')
                .setDescription('Set the channel for verification logs.')
                .addChannelOption((option: any) => option
                    .setName('channel')
                    .setDescription('The channel to log verification events.')
                    .addChannelTypes(ChannelType.GuildText)
                    .setRequired(true)))),

    async autocomplete(interaction: AutocompleteInteraction, { tables }: Context) {
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
                    } else if (subcommand === 'log-channel') {
                        await handleVerifyLogChannel(interaction, context);
                    }
                    break;

                default:
                    await interaction.reply({
                        content: "Unknown command configuration.",
                        ephemeral: true,
                    });
            }
        } catch (error) {
            log.error('Error executing config command:', error);
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';
            await interaction.reply({
                content: `An error occurred: ${errorMessage}`,
                ephemeral: true,
            });
        }
    },
};
