import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandStringOption } from 'discord.js';
import { Context } from '../types';
import { MemeTemplateAttributes } from '../types/database';

const memeTemplateCommand = {
    data: new SlashCommandBuilder()
        .setName('meme-template')
        .setDescription('Manage meme templates')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a new meme template')
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('name')
                    .setDescription('Unique name for the template')
                    .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('url')
                    .setDescription('URL of the template image')
                    .setRequired(true))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('description')
                    .setDescription('Description of the template')
                    .setRequired(false))
                .addIntegerOption(option => option
                    .setName('fontsize')
                    .setDescription('Default font size (default: 40)')
                    .setRequired(false)
                    .setMinValue(10)
                    .setMaxValue(100)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a meme template')
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('name')
                    .setDescription('Name of the template to remove')
                    .setRequired(true)
                    .setAutocomplete(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('edit')
                .setDescription('Edit an existing meme template')
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('name')
                    .setDescription('Name of the template to edit')
                    .setRequired(true)
                    .setAutocomplete(true))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('url')
                    .setDescription('New URL for the template image')
                    .setRequired(false))
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('description')
                    .setDescription('New description for the template')
                    .setRequired(false))
                .addIntegerOption(option => option
                    .setName('fontsize')
                    .setDescription('New default font size')
                    .setRequired(false)
                    .setMinValue(10)
                    .setMaxValue(100)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('toggle')
                .setDescription('Enable or disable a meme template')
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('name')
                    .setDescription('Name of the template to toggle')
                    .setRequired(true)
                    .setAutocomplete(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('info')
                .setDescription('Get detailed information about a meme template')
                .addStringOption((option: SlashCommandStringOption) => option
                    .setName('name')
                    .setDescription('Name of the template to view')
                    .setRequired(true)
                    .setAutocomplete(true)),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('stats')
                .setDescription('View meme template usage statistics')
                .addIntegerOption(option => option
                    .setName('limit')
                    .setDescription('Number of top templates to show (default: 10)')
                    .setRequired(false)
                    .setMinValue(1)
                    .setMaxValue(25)),
        ),

    async autocomplete(interaction: any, context: Context) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'name') {
            try {
                const templates = await context.tables.MemeTemplate.findAll({
                    limit: 25,
                    order: [['name', 'ASC']],
                });

                const filtered = templates
                    .filter((template: MemeTemplateAttributes) =>
                        template.name.toLowerCase().includes(focusedOption.value.toLowerCase()),
                    )
                    .slice(0, 25);

                await interaction.respond(
                    filtered.map((template: MemeTemplateAttributes) => ({
                        name: `${template.name} ${template.is_active ? '✅' : '❌'}`,
                        value: template.name,
                    })),
                );
            } catch (error) {
                context.log.error({ error }, 'Error in template autocomplete');
                await interaction.respond([]);
            }
        }
    },

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'add':
                    await handleAddTemplate(interaction, context);
                    break;
                case 'remove':
                    await handleRemoveTemplate(interaction, context);
                    break;
                case 'edit':
                    await handleEditTemplate(interaction, context);
                    break;
                case 'toggle':
                    await handleToggleTemplate(interaction, context);
                    break;
                case 'info':
                    await handleTemplateInfo(interaction, context);
                    break;
                case 'stats':
                    await handleTemplateStats(interaction, context);
                    break;
                default:
                    await interaction.reply({ content: 'Unknown subcommand.', ephemeral: true });
            }
        } catch (error) {
            context.log.error({ error }, 'Error in meme-template command');
            const errorMessage = 'An error occurred while processing the template command.';

            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({ content: errorMessage, ephemeral: true });
            } else {
                await interaction.reply({ content: errorMessage, ephemeral: true });
            }
        }
    },
};

async function handleAddTemplate(interaction: ChatInputCommandInteraction, context: Context) {
    const name = interaction.options.getString('name', true).trim();
    const url = interaction.options.getString('url', true).trim();
    const description = interaction.options.getString('description')?.trim() || null;
    const fontSize = interaction.options.getInteger('fontsize') || 40;

    try {
        new URL(url);
    } catch {
        await interaction.reply({ content: 'Invalid URL provided.', ephemeral: true });
        return;
    }


    try {
        const existingTemplate = await context.tables.MemeTemplate.findOne({
            where: { name },
        });

        if (existingTemplate) {
            await interaction.reply({
                content: `Template with name "${name}" already exists.`,
                ephemeral: true,
            });
            return;
        }

        await context.tables.MemeTemplate.create({
            name,
            url,
            description: description || undefined,
            // text_positions removed - now uses standardized positioning
            default_font_size: fontSize,
            creator: interaction.user.username,
            usage_count: 0,
            is_active: true,
        });

        const embed = {
            title: '✅ Template Added Successfully',
            description: `**${name}** has been added to the meme templates.`,
            fields: [
                { name: 'URL', value: url, inline: false },
                { name: 'Description', value: description || 'No description', inline: true },
                { name: 'Font Size', value: fontSize.toString(), inline: true },
            ],
            color: 0x00FF00,
            footer: {
                text: `Created by ${interaction.user.username}`,
            },
        };

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ error, name }, 'Failed to add meme template');
        await interaction.reply({
            content: 'Failed to add template. Please try again.',
            ephemeral: true,
        });
    }
}

async function handleRemoveTemplate(interaction: ChatInputCommandInteraction, context: Context) {
    const name = interaction.options.getString('name', true);

    try {
        const template = await context.tables.MemeTemplate.findOne({
            where: { name },
        }) as MemeTemplateAttributes | null;

        if (!template) {
            await interaction.reply({ content: 'Template not found.', ephemeral: true });
            return;
        }

        await context.tables.MemeTemplate.destroy({
            where: { name },
        });

        await interaction.reply({
            content: `✅ Template "${name}" has been removed successfully.`,
        });
    } catch (error) {
        context.log.error({ error, name }, 'Failed to remove meme template');
        await interaction.reply({
            content: 'Failed to remove template. Please try again.',
            ephemeral: true,
        });
    }
}

async function handleEditTemplate(interaction: ChatInputCommandInteraction, context: Context) {
    const name = interaction.options.getString('name', true);
    const newUrl = interaction.options.getString('url');
    const newDescription = interaction.options.getString('description');
    const newFontSize = interaction.options.getInteger('fontsize');

    try {
        const template = await context.tables.MemeTemplate.findOne({
            where: { name },
        }) as MemeTemplateAttributes | null;

        if (!template) {
            await interaction.reply({ content: 'Template not found.', ephemeral: true });
            return;
        }

        const updates: Partial<MemeTemplateAttributes> = {};

        if (newUrl) {
            try {
                new URL(newUrl);
                updates.url = newUrl;
            } catch {
                await interaction.reply({ content: 'Invalid URL provided.', ephemeral: true });
                return;
            }
        }

        if (typeof newDescription === 'string') {
            updates.description = newDescription;
        }

        if (newFontSize) {
            updates.default_font_size = newFontSize;
        }


        if (Object.keys(updates).length === 0) {
            await interaction.reply({
                content: 'No changes specified.',
                ephemeral: true,
            });
            return;
        }

        await context.tables.MemeTemplate.upsert({
            ...template,
            ...updates,
        });

        const embed = {
            title: '✅ Template Updated Successfully',
            description: `**${name}** has been updated.`,
            fields: Object.entries(updates).map(([key, value]) => ({
                name: key.replace('_', ' ').replace(/\b\w/g, l => l.toUpperCase()),
                value: typeof value === 'object' ? JSON.stringify(value) : String(value),
                inline: true,
            })),
            color: 0x00FF00,
        };

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ error, name }, 'Failed to edit meme template');
        await interaction.reply({
            content: 'Failed to edit template. Please try again.',
            ephemeral: true,
        });
    }
}

async function handleToggleTemplate(interaction: ChatInputCommandInteraction, context: Context) {
    const name = interaction.options.getString('name', true);

    try {
        const template = await context.tables.MemeTemplate.findOne({
            where: { name },
        }) as MemeTemplateAttributes | null;

        if (!template) {
            await interaction.reply({ content: 'Template not found.', ephemeral: true });
            return;
        }

        const newStatus = !template.is_active;
        await context.tables.MemeTemplate.upsert({
            ...template,
            is_active: newStatus,
        });

        const statusText = newStatus ? 'enabled' : 'disabled';
        const emoji = newStatus ? '✅' : '❌';

        await interaction.reply({
            content: `${emoji} Template "${name}" has been ${statusText}.`,
        });
    } catch (error) {
        context.log.error({ error, name }, 'Failed to toggle meme template');
        await interaction.reply({
            content: 'Failed to toggle template. Please try again.',
            ephemeral: true,
        });
    }
}

async function handleTemplateInfo(interaction: ChatInputCommandInteraction, context: Context) {
    const name = interaction.options.getString('name', true);

    try {
        const template = await context.tables.MemeTemplate.findOne({
            where: { name },
        }) as MemeTemplateAttributes | null;

        if (!template) {
            await interaction.reply({ content: 'Template not found.', ephemeral: true });
            return;
        }

        const embed = {
            title: `🎭 ${template.name}`,
            description: template.description || 'No description available',
            fields: [
                { name: 'Status', value: template.is_active ? '✅ Active' : '❌ Inactive', inline: true },
                { name: 'Usage Count', value: template.usage_count.toString(), inline: true },
                { name: 'Font Size', value: template.default_font_size.toString(), inline: true },
                { name: 'Text Positions', value: 'Standardized (top/bottom)', inline: true },
                { name: 'Creator', value: template.creator || 'Unknown', inline: true },
                { name: 'Created',
                    value: template.createdAt ? new Date(template.createdAt).toDateString() : 'Unknown', inline: true },
            ],
            image: {
                url: template.url,
            },
            color: template.is_active ? 0x00FF00 : 0xFF0000,
        };

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ error, name }, 'Failed to get template info');
        await interaction.reply({
            content: 'Failed to get template information. Please try again.',
            ephemeral: true,
        });
    }
}

async function handleTemplateStats(interaction: ChatInputCommandInteraction, context: Context) {
    const limit = interaction.options.getInteger('limit') || 10;

    try {
        const templates = await context.tables.MemeTemplate.findAll({
            limit,
            order: [['usage_count', 'DESC'], ['name', 'ASC']],
        }) as MemeTemplateAttributes[];

        if (templates.length === 0) {
            await interaction.reply('No templates found.');
            return;
        }

        const totalCount = await context.tables.MemeTemplate.count();
        const activeCount = await context.tables.MemeTemplate.count({ where: { is_active: true } });
        const totalUsage = templates.reduce((sum, t) => sum + t.usage_count, 0);

        const statsList = templates
            .map((template, index) => {
                const rank = index + 1;
                const status = template.is_active ? '✅' : '❌';
                return `${rank}. ${status} **${template.name}** - ${template.usage_count} uses`;
            })
            .join('\n');

        const embed = {
            title: '📊 Meme Template Statistics',
            description: statsList,
            fields: [
                { name: 'Total Templates', value: totalCount.toString(), inline: true },
                { name: 'Active Templates', value: activeCount.toString(), inline: true },
                { name: 'Total Usage', value: totalUsage.toString(), inline: true },
            ],
            color: 0x0099FF,
            footer: {
                text: `Showing top ${Math.min(limit, templates.length)} templates`,
            },
        };

        await interaction.reply({ embeds: [embed] });
    } catch (error) {
        context.log.error({ error }, 'Failed to get template stats');
        await interaction.reply({
            content: 'Failed to get template statistics. Please try again.',
            ephemeral: true,
        });
    }
}

export default memeTemplateCommand;