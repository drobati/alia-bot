import {
    SlashCommandBuilder,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    GuildMemberRoleManager,
} from "discord.js";
import { Context } from "../types";
import { checkOwnerPermission } from "../utils/permissions";

const CONFIG_KEY_PREFIX = 'subscribe_allowed_roles_';

/**
 * Get the list of role IDs that are allowed for subscription in a guild
 */
async function getSubscribeAllowedRoles(tables: any, guildId: string): Promise<string[]> {
    const config = await tables.Config.findOne({
        where: { key: `${CONFIG_KEY_PREFIX}${guildId}` },
    });
    if (!config || !config.value) {
        return [];
    }
    try {
        return JSON.parse(config.value);
    } catch {
        return [];
    }
}

/**
 * Save the list of allowed role IDs for subscription in a guild
 */
async function setSubscribeAllowedRoles(tables: any, guildId: string, roleIds: string[]): Promise<void> {
    const key = `${CONFIG_KEY_PREFIX}${guildId}`;
    const value = JSON.stringify(roleIds);
    await tables.Config.upsert({ key, value });
}

/**
 * Check if a user has at least one role besides @everyone (not in purgatory)
 */
function hasAnyRoles(member: any): boolean {
    const roleManager = member.roles as GuildMemberRoleManager;
    // Filter out @everyone role (which has the same ID as the guild)
    const nonEveryoneRoles = roleManager.cache.filter((role: any) => role.id !== member.guild.id);
    return nonEveryoneRoles.size > 0;
}

const subscribeCommand = {
    data: new SlashCommandBuilder()
        .setName('subscribe')
        .setDescription('Subscribe to available roles in the server.')
        .addSubcommand((subcommand: any) => subcommand
            .setName('role')
            .setDescription('Subscribe to a role.')
            .addRoleOption((option: any) => option
                .setName('role')
                .setDescription('The role you want to subscribe to.')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('list')
            .setDescription('List all roles available for subscription.'))
        .addSubcommandGroup((group: any) => group
            .setName('config')
            .setDescription('Configure subscribable roles (owner only).')
            .addSubcommand((subcommand: any) => subcommand
                .setName('add')
                .setDescription('Add a role to the subscription whitelist.')
                .addRoleOption((option: any) => option
                    .setName('role')
                    .setDescription('The role to allow for subscription.')
                    .setRequired(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('remove')
                .setDescription('Remove a role from the subscription whitelist.')
                .addStringOption((option: any) => option
                    .setName('role')
                    .setDescription('The role to remove from subscription.')
                    .setRequired(true)
                    .setAutocomplete(true)))
            .addSubcommand((subcommand: any) => subcommand
                .setName('list')
                .setDescription('List all roles in the subscription whitelist.'))),

    async autocomplete(interaction: AutocompleteInteraction, { tables, log }: Context) {
        try {
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.respond([]);
                return;
            }

            const subcommandGroup = interaction.options.getSubcommandGroup();
            const subcommand = interaction.options.getSubcommand();

            // Only provide autocomplete for config remove
            if (subcommandGroup === 'config' && subcommand === 'remove') {
                const allowedRoleIds = await getSubscribeAllowedRoles(tables, guildId);
                if (allowedRoleIds.length === 0) {
                    await interaction.respond([]);
                    return;
                }

                const focusedValue = interaction.options.getFocused().toLowerCase();
                const choices = allowedRoleIds
                    .map(roleId => {
                        const role = interaction.guild?.roles.cache.get(roleId);
                        return role ? { name: role.name, value: roleId } : null;
                    })
                    .filter((choice): choice is { name: string; value: string } => choice !== null)
                    .filter(choice => choice.name.toLowerCase().includes(focusedValue));

                await interaction.respond(choices.slice(0, 25));
            } else {
                await interaction.respond([]);
            }
        } catch (error) {
            log.error({ error }, 'Error in subscribe autocomplete');
            await interaction.respond([]);
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { tables, log } = context;
        const guildId = interaction.guildId;

        if (!guildId) {
            return interaction.reply({
                content: "This command can only be used in a server.",
                ephemeral: true,
            });
        }

        const member = interaction.member;
        if (!member) {
            return interaction.reply({
                content: "Could not find your member information.",
                ephemeral: true,
            });
        }

        const subcommandGroup = interaction.options.getSubcommandGroup();
        const subcommand = interaction.options.getSubcommand();

        // Handle config subcommand group (owner only)
        if (subcommandGroup === 'config') {
            await checkOwnerPermission(interaction, context);

            if (subcommand === 'add') {
                return handleConfigAdd(interaction, tables, log, guildId);
            } else if (subcommand === 'remove') {
                return handleConfigRemove(interaction, tables, log, guildId);
            } else if (subcommand === 'list') {
                return handleConfigList(interaction, tables, log, guildId);
            }
        }

        // Handle regular subcommands
        if (subcommand === 'list') {
            return handleList(interaction, tables, log, guildId);
        } else if (subcommand === 'role') {
            return handleRole(interaction, tables, log, guildId, member);
        }

        return interaction.reply({
            content: "Unknown subcommand.",
            ephemeral: true,
        });
    },
};

async function handleConfigAdd(
    interaction: ChatInputCommandInteraction,
    tables: any,
    log: any,
    guildId: string,
) {
    const role = interaction.options.getRole('role', true);

    // Don't allow adding @everyone
    if (role.id === guildId) {
        return interaction.reply({
            content: "You cannot add the @everyone role to the subscription list.",
            ephemeral: true,
        });
    }

    // Don't allow adding managed roles (bot roles, integration roles, etc.)
    if (role.managed) {
        return interaction.reply({
            content: "You cannot add managed roles (bot roles, integration roles) to the subscription list.",
            ephemeral: true,
        });
    }

    const allowedRoles = await getSubscribeAllowedRoles(tables, guildId);

    if (allowedRoles.includes(role.id)) {
        return interaction.reply({
            content: `**${role.name}** is already in the subscription whitelist.`,
            ephemeral: true,
        });
    }

    allowedRoles.push(role.id);
    await setSubscribeAllowedRoles(tables, guildId, allowedRoles);

    log.info({
        guildId,
        roleId: role.id,
        roleName: role.name,
        addedBy: interaction.user.id,
    }, 'Role added to subscribe whitelist');

    return interaction.reply({
        content: `Added **${role.name}** to the subscription whitelist.`,
        ephemeral: true,
    });
}

async function handleConfigRemove(
    interaction: ChatInputCommandInteraction,
    tables: any,
    log: any,
    guildId: string,
) {
    const roleId = interaction.options.getString('role', true);
    const allowedRoles = await getSubscribeAllowedRoles(tables, guildId);

    if (!allowedRoles.includes(roleId)) {
        return interaction.reply({
            content: "That role is not in the subscription whitelist.",
            ephemeral: true,
        });
    }

    const newAllowedRoles = allowedRoles.filter((id: string) => id !== roleId);
    await setSubscribeAllowedRoles(tables, guildId, newAllowedRoles);

    // Try to get role name for logging
    const role = interaction.guild?.roles.cache.get(roleId);
    const roleName = role?.name || roleId;

    log.info({
        guildId,
        roleId,
        roleName,
        removedBy: interaction.user.id,
    }, 'Role removed from subscribe whitelist');

    return interaction.reply({
        content: `Removed **${roleName}** from the subscription whitelist.`,
        ephemeral: true,
    });
}

async function handleConfigList(
    interaction: ChatInputCommandInteraction,
    tables: any,
    log: any,
    guildId: string,
) {
    const allowedRoles = await getSubscribeAllowedRoles(tables, guildId);

    if (allowedRoles.length === 0) {
        return interaction.reply({
            content: "No roles are configured for subscription. Use `/subscribe config add` to add roles.",
            ephemeral: true,
        });
    }

    const roleList = allowedRoles
        .map((roleId: string) => {
            const role = interaction.guild?.roles.cache.get(roleId);
            return role ? `- **${role.name}**` : `- Unknown role (${roleId})`;
        })
        .join('\n');

    return interaction.reply({
        content: `**Subscribable Roles:**\n${roleList}`,
        ephemeral: true,
    });
}

async function handleList(
    interaction: ChatInputCommandInteraction,
    tables: any,
    log: any,
    guildId: string,
) {
    const allowedRoles = await getSubscribeAllowedRoles(tables, guildId);

    if (allowedRoles.length === 0) {
        return interaction.reply({
            content: "No roles are available for subscription.",
            ephemeral: true,
        });
    }

    // Get user's current roles to show which they already have
    const member = interaction.member;
    const roleManager = member?.roles as GuildMemberRoleManager;
    const userRoleIds = roleManager?.cache.map(r => r.id) || [];

    const roleList = allowedRoles
        .map((roleId: string) => {
            const role = interaction.guild?.roles.cache.get(roleId);
            if (!role) {
                return null;
            }
            const hasRole = userRoleIds.includes(roleId);
            return `- **${role.name}**${hasRole ? ' *(subscribed)*' : ''}`;
        })
        .filter((line: string | null) => line !== null)
        .join('\n');

    if (!roleList) {
        return interaction.reply({
            content: "No roles are available for subscription.",
            ephemeral: true,
        });
    }

    return interaction.reply({
        content: `**Available Roles:**\n${roleList}\n\nUse \`/subscribe role\` to subscribe to a role.`,
        ephemeral: true,
    });
}

async function handleRole(
    interaction: ChatInputCommandInteraction,
    tables: any,
    log: any,
    guildId: string,
    member: any,
) {
    // Check if user is in purgatory (has no roles besides @everyone)
    if (!hasAnyRoles(member)) {
        return interaction.reply({
            content: "You must be verified before you can subscribe to roles. "
                + "Please complete the verification process first.",
            ephemeral: true,
        });
    }

    const role = interaction.options.getRole('role', true);

    // Check if the role is in the whitelist
    const allowedRoles = await getSubscribeAllowedRoles(tables, guildId);
    if (allowedRoles.length === 0) {
        return interaction.reply({
            content: "No roles are configured for subscription.",
            ephemeral: true,
        });
    }

    if (!allowedRoles.includes(role.id)) {
        return interaction.reply({
            content: `**${role.name}** is not available for subscription. `
                + 'Use `/subscribe list` to see available roles.',
            ephemeral: true,
        });
    }

    // Check if user already has the role
    const roleManager = member.roles as GuildMemberRoleManager;
    if (roleManager.cache.has(role.id)) {
        return interaction.reply({
            content: `You already have the **${role.name}** role.`,
            ephemeral: true,
        });
    }

    try {
        // Add the role to the user
        await roleManager.add(role.id, 'User subscribed via /subscribe command');

        log.info({
            guildId,
            userId: interaction.user.id,
            roleId: role.id,
            roleName: role.name,
        }, 'User subscribed to role');

        return interaction.reply({
            content: `You have subscribed to **${role.name}**.`,
            ephemeral: true,
        });
    } catch (error) {
        log.error({
            error,
            guildId,
            userId: interaction.user.id,
            roleId: role.id,
        }, 'Error adding role to user');

        return interaction.reply({
            content: "There was an error adding the role. The bot may not have permission to assign this role.",
            ephemeral: true,
        });
    }
}

export default subscribeCommand;
