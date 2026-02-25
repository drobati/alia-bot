import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
    AutocompleteInteraction,
} from "discord.js";
import { Op } from "sequelize";
import { Context } from "../types";
import { checkOwnerPermission, isOwner } from "../utils/permissions";
import { Sentry } from "../lib/sentry";

export default {
    data: new SlashCommandBuilder()
        .setName('voice')
        .setDescription('Manage saved TTS voices.')
        .addSubcommand((subcommand: any) => subcommand
            .setName('add')
            .setDescription('Save a new voice.')
            .addStringOption((option: any) => option
                .setName('name')
                .setDescription('Friendly name for this voice')
                .setRequired(true))
            .addStringOption((option: any) => option
                .setName('voice-id')
                .setDescription('ElevenLabs voice ID')
                .setRequired(true))
            .addStringOption((option: any) => option
                .setName('description')
                .setDescription('Description of the voice')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('remove')
            .setDescription('Delete a saved voice.')
            .addStringOption((option: any) => option
                .setName('name')
                .setDescription('Name of the voice to remove')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('list')
            .setDescription('List all saved voices.')),

    async autocomplete(interaction: AutocompleteInteraction, { tables }: Context) {
        if (!isOwner(interaction.user.id)) {
            await interaction.respond([]);
            return;
        }

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
                value: v.name,
            })),
        );
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        log.info({
            subcommand,
            userId: interaction.user.id,
        }, 'Voice command received');

        try {
            await checkOwnerPermission(interaction, context);

            switch (subcommand) {
                case 'add':
                    await handleAdd(interaction, context);
                    break;
                case 'remove':
                    await handleRemove(interaction, context);
                    break;
                case 'list':
                    await handleList(interaction, context);
                    break;
                default:
                    await interaction.reply({
                        content: 'Unknown subcommand.',
                        ephemeral: true,
                    });
            }
        } catch (error) {
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            if (error.message?.includes('Unauthorized')) {
                return;
            }

            Sentry.captureException(error, {
                tags: { command: 'voice', subcommand },
            });

            log.error({ error, subcommand }, 'Voice command error');

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: 'Something went wrong.',
                    ephemeral: true,
                });
            }
        }
    },
};

async function handleAdd(interaction: ChatInputCommandInteraction, context: Context) {
    const name = interaction.options.getString('name', true).toLowerCase().trim();
    const voiceId = interaction.options.getString('voice-id', true).trim();
    const description = interaction.options.getString('description', true).trim();

    const existing = await context.tables.Voice.findOne({
        where: { name },
    });

    if (existing) {
        await interaction.reply({
            content: `Voice **${name}** already exists. Remove it first to re-add.`,
            ephemeral: true,
        });
        return;
    }

    await context.tables.Voice.create({ name, voiceId, description });

    await interaction.reply({
        content: `Saved voice **${name}** (\`${voiceId}\`)\n> ${description}`,
        ephemeral: true,
    });
}

async function handleRemove(interaction: ChatInputCommandInteraction, context: Context) {
    const name = interaction.options.getString('name', true).toLowerCase().trim();

    const deleted = await context.tables.Voice.destroy({
        where: { name },
    });

    if (deleted === 0) {
        await interaction.reply({
            content: `No voice found with name **${name}**.`,
            ephemeral: true,
        });
        return;
    }

    await interaction.reply({
        content: `Removed voice **${name}**.`,
        ephemeral: true,
    });
}

async function handleList(interaction: ChatInputCommandInteraction, context: Context) {
    const voices = await context.tables.Voice.findAll({
        order: [['name', 'ASC']],
    });

    if (voices.length === 0) {
        await interaction.reply({
            content: 'No saved voices. Use `/voice add` to save one.',
            ephemeral: true,
        });
        return;
    }

    const lines = voices.map((v: any) =>
        `**${v.name}** \`${v.voiceId}\`\n> ${v.description}`
    );

    await interaction.reply({
        content: `**Saved Voices (${voices.length})**\n\n${lines.join('\n\n')}`,
        ephemeral: true,
    });
}
