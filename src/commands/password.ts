import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    ChannelType,
    PermissionFlagsBits,
} from "discord.js";
import { Context } from "../types";
import { checkOwnerPermission } from "../utils/permissions";

async function handleSet(interaction: ChatInputCommandInteraction, context: Context) {
    const role = interaction.options.getRole('role', true);
    const password = interaction.options.getString('password', true).toLowerCase();
    const channel = interaction.options.getChannel('channel', true);

    await context.tables.Password.create({
        guildId: interaction.guildId!,
        channelId: channel.id,
        roleId: role.id,
        password,
        createdBy: interaction.user.id,
        active: true,
    });

    await interaction.reply({
        content: `Password rule created:\n`
            + `**Channel:** <#${channel.id}>\n`
            + `**Role:** <@&${role.id}>\n`
            + `**Password:** ||${password}||`,
        ephemeral: true,
    });
}

async function handleList(interaction: ChatInputCommandInteraction, context: Context) {
    const guildId = interaction.guildId!;

    const rules = await context.tables.Password.findAll({
        where: { guildId, active: true },
    });

    if (rules.length === 0) {
        return interaction.reply({
            content: 'No active password rules for this server.',
            ephemeral: true,
        });
    }

    const lines = rules.map((r: any) =>
        `**#${r.id}** — <#${r.channelId}> → <@&${r.roleId}> — ||${r.password}||`,
    );

    await interaction.reply({
        content: `**Active Password Rules**\n${lines.join('\n')}`,
        ephemeral: true,
    });
}

async function handleRemove(interaction: ChatInputCommandInteraction, context: Context) {
    const id = interaction.options.getInteger('id', true);
    const guildId = interaction.guildId!;

    const rule = await context.tables.Password.findOne({
        where: { id, guildId, active: true },
    });

    if (!rule) {
        return interaction.reply({
            content: `No active password rule found with ID **${id}**.`,
            ephemeral: true,
        });
    }

    await context.tables.Password.update(
        { active: false },
        { where: { id } },
    );

    await interaction.reply({
        content: `Password rule **#${id}** has been removed.`,
        ephemeral: true,
    });
}

export default {
    data: new SlashCommandBuilder()
        .setName('password')
        .setDescription('Manage channel-based password role assignments.')
        .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild)
        .addSubcommand((subcommand: any) => subcommand
            .setName('set')
            .setDescription('Create a password rule for a channel.')
            .addRoleOption((option: any) => option
                .setName('role')
                .setDescription('The role to grant when the password is typed.')
                .setRequired(true))
            .addStringOption((option: any) => option
                .setName('password')
                .setDescription('The password (case-insensitive).')
                .setRequired(true))
            .addChannelOption((option: any) => option
                .setName('channel')
                .setDescription('The channel to listen in.')
                .addChannelTypes(ChannelType.GuildText)
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('list')
            .setDescription('List all active password rules for this server.'))
        .addSubcommand((subcommand: any) => subcommand
            .setName('remove')
            .setDescription('Remove a password rule by ID.')
            .addIntegerOption((option: any) => option
                .setName('id')
                .setDescription('The ID of the password rule to remove.')
                .setRequired(true))),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        try {
            await checkOwnerPermission(interaction, context);

            switch (subcommand) {
                case 'set':
                    await handleSet(interaction, context);
                    break;
                case 'list':
                    await handleList(interaction, context);
                    break;
                case 'remove':
                    await handleRemove(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            if (error.message?.includes('Unauthorized')) {
                return;
            }

            log.error({ error, subcommand }, 'Error executing password command');
            const errorMessage = error instanceof Error ? error.message : 'Unknown error';

            try {
                if (interaction.replied || interaction.deferred) {
                    await interaction.followUp({ content: `An error occurred: ${errorMessage}`, ephemeral: true });
                } else {
                    await interaction.reply({ content: `An error occurred: ${errorMessage}`, ephemeral: true });
                }
            } catch (replyError) {
                log.error({ error: replyError }, 'Failed to send error reply');
            }
        }
    },
};
