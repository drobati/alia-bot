import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandStringOption } from 'discord.js';
import { Context } from '../types';
import { MemeGenerator } from '../utils/memeGenerator';
import { MemeTemplateAttributes } from '../types/database';

const memeCommand = {
    data: new SlashCommandBuilder()
        .setName('meme')
        .setDescription('Generate memes with text overlays')
        .addSubcommand(subcommand =>
            subcommand
                .setName('create')
                .setDescription('Create a meme using a template')
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('template')
                    .setDescription('Name of the meme template to use')
                    .setRequired(true)
                    .setAutocomplete(true))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('top')
                    .setDescription('Top text for the meme')
                    .setRequired(false))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('bottom')
                    .setDescription('Bottom text for the meme')
                    .setRequired(false)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('custom')
                .setDescription('Create a meme with a custom image URL')
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('url')
                    .setDescription('URL of the image to use')
                    .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('top')
                    .setDescription('Top text for the meme')
                    .setRequired(false))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('bottom')
                    .setDescription('Bottom text for the meme')
                    .setRequired(false)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List available meme templates')
                .addIntegerOption(option => option
                    .setName('page')
                    .setDescription('Page number (10 templates per page)')
                    .setRequired(false)
                    .setMinValue(1)),
        ),

    async autocomplete(interaction: any, context: Context) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'template') {
            try {
                const templates = await context.tables.MemeTemplate.findAll({
                    where: { is_active: true },
                    limit: 25,
                    order: [['usage_count', 'DESC'], ['name', 'ASC']],
                });

                const filtered = templates
                    .filter((template: MemeTemplateAttributes) =>
                        template.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
                    )
                    .slice(0, 25);

                await interaction.respond(
                    filtered.map((template: MemeTemplateAttributes) => ({
                        name: template.name,
                        value: template.name,
                    })),
                );
            } catch (error) {
                context.log.error({ error }, 'Error in meme template autocomplete');
                await interaction.respond([]);
            }
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        try {
            const subcommand = interaction.options.getSubcommand();
            
            switch (subcommand) {
                case 'create':
                    await handleCreateMeme(interaction, context);
                    break;
                case 'custom':
                    await handleCustomMeme(interaction, context);
                    break;
                case 'list':
                    await handleListTemplates(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            context.log.error({ error }, 'Error in meme command');
            const errorMessage = 'An error occurred while processing the meme command.';

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

async function handleCreateMeme(interaction: ChatInputCommandInteraction, context: Context) {
    await interaction.deferReply();

    const templateName = interaction.options.getString('template', true);
    const topText = interaction.options.getString('top');
    const bottomText = interaction.options.getString('bottom');

    const template = await context.tables.MemeTemplate.findOne({
        where: { name: templateName, is_active: true },
    }) as MemeTemplateAttributes | null;

    if (!template) {
        await interaction.editReply('Template not found or inactive.');
        return;
    }

    if (!topText && !bottomText) {
        await interaction.editReply('At least one text field (top or bottom) must be provided.');
        return;
    }

    try {
        const memeBuffer = await MemeGenerator.generateMeme(template, topText || undefined, bottomText || undefined);

        // Increment usage count
        if (template.id) {
            await context.sequelize.query(
                'UPDATE meme_templates SET usage_count = usage_count + 1 WHERE id = ?',
                { replacements: [template.id] },
            );
        }

        await interaction.editReply({
            files: [{
                attachment: memeBuffer,
                name: `${template.name.toLowerCase().replace(/\s+/g, '_')}_meme.png`,
            }],
        });
    } catch (error) {
        context.log.error({ error, templateName }, 'Failed to generate meme');
        await interaction.editReply('Failed to generate meme. Please try again later.');
    }
}

async function handleCustomMeme(interaction: ChatInputCommandInteraction, context: Context) {
    await interaction.deferReply();

    const imageUrl = interaction.options.getString('url', true);
    const topText = interaction.options.getString('top');
    const bottomText = interaction.options.getString('bottom');

    if (!topText && !bottomText) {
        await interaction.editReply('At least one text field (top or bottom) must be provided.');
        return;
    }

    try {
        new URL(imageUrl);
    } catch {
        await interaction.editReply('Invalid image URL provided.');
        return;
    }

    try {
        const memeBuffer = await MemeGenerator.generateCustomMeme(
            imageUrl,
            topText || undefined,
            bottomText || undefined,
        );

        await interaction.editReply({
            files: [{
                attachment: memeBuffer,
                name: 'custom_meme.png',
            }],
        });
    } catch (error) {
        context.log.error({ error, imageUrl }, 'Failed to generate custom meme');
        await interaction.editReply('Failed to generate meme. Please check the image URL and try again.');
    }
}

async function handleListTemplates(interaction: ChatInputCommandInteraction, context: Context) {
    const page = interaction.options.getInteger('page') || 1;
    const limit = 10;
    const offset = (page - 1) * limit;

    try {
        const { count, rows: templates } = await context.tables.MemeTemplate.findAndCountAll({
            where: { is_active: true },
            limit,
            offset,
            order: [['usage_count', 'DESC'], ['name', 'ASC']],
        });

        if (templates.length === 0) {
            await interaction.reply('No meme templates available.');
            return;
        }

        const totalPages = Math.ceil(count / limit);
        const templateList = (templates as MemeTemplateAttributes[])
            .map((template, index) => {
                const num = offset + index + 1;
                const usage = template.usage_count > 0 ? ` (used ${template.usage_count}x)` : '';
                const desc = template.description ? ` - ${template.description}` : '';
                return `${num}. **${template.name}**${usage}${desc}`;
            })
            .join('\n');

        const embed = {
            title: '🎭 Available Meme Templates',
            description: templateList,
            color: 0x00FF00,
            footer: {
                text: `Page ${page}/${totalPages} | Total: ${count} templates`,
            },
        };

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ error }, 'Error listing meme templates');
        await interaction.reply({ content: 'Failed to list templates.', ephemeral: true });
    }
}

export default memeCommand;