import {
    SlashCommandBuilder,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    GuildMemberRoleManager,
} from "discord.js";
import { Op } from "sequelize";
import { Context } from "../types";
import { isOwner } from "../utils/permissions";

// Character set excluding ambiguous characters (0, 1, O, I, L)
const CODE_CHARS = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
const CODE_LENGTH = 6;
const MAX_ACTIVE_CODES = 5;
const DEFAULT_EXPIRATION_SECONDS = 86400; // 24 hours

function generateCode(): string {
    let code = '';
    for (let i = 0; i < CODE_LENGTH; i++) {
        code += CODE_CHARS.charAt(Math.floor(Math.random() * CODE_CHARS.length));
    }
    return `V-${code}`;
}

async function getVerifyExpiration(tables: any, guildId: string): Promise<number> {
    const config = await tables.Config.findOne({
        where: { key: `verify_expiration_${guildId}` },
    });
    return config ? parseInt(config.value, 10) : DEFAULT_EXPIRATION_SECONDS;
}

async function getAllowedRoles(tables: any, guildId: string): Promise<string[]> {
    const config = await tables.Config.findOne({
        where: { key: `verify_allowed_roles_${guildId}` },
    });
    if (!config || !config.value) {return [];}
    try {
        return JSON.parse(config.value);
    } catch {
        return [];
    }
}

async function getActiveCodeCount(
    tables: any,
    guildId: string,
    userId: string,
    expirationSeconds: number,
): Promise<number> {
    const expirationDate = new Date(Date.now() - expirationSeconds * 1000);
    return await tables.VerificationCode.count({
        where: {
            guildId,
            generatorId: userId,
            used: false,
            createdAt: { [Op.gte]: expirationDate },
        },
    });
}

const verifyCommand = {
    data: new SlashCommandBuilder()
        .setName('verify')
        .setDescription('Generate a verification code to invite a friend and grant them a role.')
        .addStringOption((option: any) => option
            .setName('role')
            .setDescription('The role to grant when the code is used.')
            .setRequired(true)
            .setAutocomplete(true)),

    async autocomplete(interaction: AutocompleteInteraction, { tables, log }: Context) {
        try {
            const guildId = interaction.guildId;
            if (!guildId) {
                await interaction.respond([]);
                return;
            }

            const member = interaction.member;
            if (!member) {
                await interaction.respond([]);
                return;
            }

            // Get allowed roles from config
            const allowedRoleIds = await getAllowedRoles(tables, guildId);
            if (allowedRoleIds.length === 0) {
                await interaction.respond([]);
                return;
            }

            // Get user's roles
            const userRoles = member.roles;
            const roleManager = userRoles as GuildMemberRoleManager;
            const userRoleIds = roleManager.cache.map(r => r.id);

            // Owner can see all whitelisted roles, others only see roles they have
            const userIsOwner = isOwner(interaction.user.id);
            const availableRoles = userIsOwner
                ? interaction.guild?.roles.cache.filter(role => allowedRoleIds.includes(role.id))
                : roleManager.cache.filter(role =>
                    allowedRoleIds.includes(role.id) && userRoleIds.includes(role.id),
                );

            if (!availableRoles) {
                await interaction.respond([]);
                return;
            }

            const focusedValue = interaction.options.getFocused().toLowerCase();
            const choices = availableRoles
                .filter(role => role.name.toLowerCase().includes(focusedValue))
                .map(role => ({
                    name: role.name,
                    value: role.id,
                }));

            await interaction.respond(choices.slice(0, 25));
        } catch (error) {
            log.error({ error }, 'Error in verify autocomplete');
            await interaction.respond([]);
        }
    },

    async execute(interaction: ChatInputCommandInteraction, { tables, log }: Context) {
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

        const roleId = interaction.options.getString('role', true);

        try {
            // Check if role is in whitelist
            const allowedRoleIds = await getAllowedRoles(tables, guildId);
            if (allowedRoleIds.length === 0) {
                return interaction.reply({
                    content: "No roles have been configured for verification. "
                        + "Ask an admin to set up `/config verify allowed-roles`.",
                    ephemeral: true,
                });
            }

            if (!allowedRoleIds.includes(roleId)) {
                return interaction.reply({
                    content: "That role isn't available for verification.",
                    ephemeral: true,
                });
            }

            // Check if user has the role (owner bypasses this check)
            const roleManager = member.roles as GuildMemberRoleManager;
            const userIsOwner = isOwner(interaction.user.id);
            if (!userIsOwner && !roleManager.cache.has(roleId)) {
                return interaction.reply({
                    content: "You don't have that role.",
                    ephemeral: true,
                });
            }

            // Get expiration time
            const expirationSeconds = await getVerifyExpiration(tables, guildId);

            // Check active code count
            const activeCount = await getActiveCodeCount(tables, guildId, interaction.user.id, expirationSeconds);
            if (activeCount >= MAX_ACTIVE_CODES) {
                return interaction.reply({
                    content: "You've reached the limit of 5 active codes. "
                        + 'Wait for some to expire before generating more.',
                    ephemeral: true,
                });
            }

            // Generate unique code with retry on collision
            let code = '';
            let attempts = 0;
            const maxAttempts = 10;

            while (attempts < maxAttempts) {
                code = generateCode();
                const existing = await tables.VerificationCode.findOne({
                    where: { code },
                });
                if (!existing) {break;}
                attempts++;
            }

            if (attempts >= maxAttempts) {
                throw new Error('Failed to generate unique code');
            }

            await tables.VerificationCode.create({
                code,
                guildId,
                generatorId: interaction.user.id,
                roleId,
                used: false,
            });

            // Get role name for display (check guild cache for owners who may not have the role)
            const role = roleManager.cache.get(roleId) || interaction.guild?.roles.cache.get(roleId);
            const roleName = role?.name || 'Unknown Role';

            // Calculate expiration time for display
            const expirationHours = Math.round(expirationSeconds / 3600);
            const expirationDisplay = expirationHours >= 24
                ? `${Math.round(expirationHours / 24)} day(s)`
                : `${expirationHours} hour(s)`;

            log.info({
                code,
                guildId,
                generatorId: interaction.user.id,
                roleId,
                roleName,
            }, 'Verification code generated');

            return interaction.reply({
                content: `Your verification code is: **${code}**\n\n`
                    + `Share this code with someone in the welcome channel to grant them the **${roleName}** role.\n\n`
                    + `This code expires in ${expirationDisplay} and can only be used once.`,
                ephemeral: true,
            });
        } catch (error) {
            log.error({ error }, 'Error generating verification code');
            return interaction.reply({
                content: "Sorry, there was an error generating your verification code. Please try again.",
                ephemeral: true,
            });
        }
    },
};

export default verifyCommand;
