import {
    SlashCommandBuilder,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    SlashCommandSubcommandBuilder,
    SlashCommandStringOption,
    SlashCommandIntegerOption,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    ComponentType,
} from "discord.js";
import { Op } from "sequelize";
import { Context, AutocompleteChoice } from "../types";
import { checkOwnerPermission } from "../utils/permissions";

const loudsCommand = {
    data: new SlashCommandBuilder()
        .setName('loud')
        .setDescription('Manage loud messages.')
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) => subcommand
            .setName('delete')
            .setDescription('Delete the loud with the matching text.')
            .addStringOption((option: SlashCommandStringOption) => option.setName('text')
                .setDescription('The text of the loud to delete.')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) => subcommand
            .setName('ban')
            .setDescription('Forbid a certain loud.')
            .addStringOption((option: SlashCommandStringOption) => option.setName('text')
                .setDescription('The text of the loud to ban.')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) => subcommand
            .setName('unban')
            .setDescription('Remove a forbidden loud.')
            .addStringOption((option: SlashCommandStringOption) => option.setName('text')
                .setDescription('The text of the loud to unban.')
                .setRequired(true)
                .setAutocomplete(true)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) => subcommand
            .setName('count')
            .setDescription('Show total number of louds.'))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) => subcommand
            .setName('list')
            .setDescription('List recent louds.')
            .addIntegerOption((option: SlashCommandIntegerOption) => option.setName('limit')
                .setDescription('Number of louds to show (default: 10)')
                .setRequired(false)))
        .addSubcommand((subcommand: SlashCommandSubcommandBuilder) => subcommand
            .setName('deletematch')
            .setDescription('Delete all louds matching a pattern (Owner only).')
            .addStringOption((option: SlashCommandStringOption) => option.setName('pattern')
                .setDescription('The text pattern to match (e.g., "M!PLAY")')
                .setRequired(true))),
    async autocomplete(interaction: AutocompleteInteraction, {
        tables,
        log,
    }: Context) {
        const { Louds, Louds_Banned: Banned } = tables;
        const subcommand = interaction.options.getSubcommand();
        const focusedOption = interaction.options.getFocused(true);

        let choices: AutocompleteChoice[] = [];
        if (focusedOption.name === 'text') {
            const searchText = focusedOption.value;

            if (subcommand === 'delete' || subcommand === 'ban') {
                // For delete and ban commands, we only want to autocomplete with existing louds
                const loudSearch = await Louds.findAll({
                    where: {
                        message: {
                            [Op.like]: `${searchText}%`, // Use "like" operator for partial matches
                        },
                    },
                    limit: 25,
                });
                choices = loudSearch.map(record => ({
                    name: record.message,
                    value: record.message,
                }));
            } else if (subcommand === 'unban') {
                // For unban command, we only want to autocomplete with banned louds
                const bannedSearch = await Banned.findAll({
                    where: {
                        message: {
                            [Op.like]: `${searchText}%`, // Use "like" operator for partial matches
                        },
                    },
                    limit: 25,
                });
                choices = bannedSearch.map(record => ({
                    name: record.message,
                    value: record.message,
                }));
            }

            log.info({ subcommand, searchText, choices }, 'Autocomplete search results');
        }
        await interaction.respond(choices.slice(0, 25));
    },
    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { tables, log } = context;
        const { Louds, Louds_Banned: Banned } = tables;
        const subcommand = interaction.options.getSubcommand();
        const text = interaction.options.getString('text');
        const pattern = interaction.options.getString('pattern');

        try {
            // Owner-only subcommands
            if (['delete', 'ban', 'unban', 'deletematch'].includes(subcommand)) {
                await checkOwnerPermission(interaction, context);
            }

            switch (subcommand) {
                case 'delete':
                    return await removeWithConfirmation(Louds, interaction, text!, log);

                case 'ban':
                    await add(Banned, interaction);
                    if (await Louds.findOne({ where: { message: text } })) {
                        await Louds.destroy({ where: { message: text } });
                        return interaction.reply({ content: "I've removed & banned that loud.", ephemeral: true });
                    }
                    return interaction.reply({ content: "I've banned that loud.", ephemeral: true });

                case 'unban':
                    if (await Banned.findOne({ where: { message: text } })) {
                        await add(Louds, interaction);
                        await Banned.destroy({ where: { message: text } });
                        return interaction.reply({ content: "I've added & unbanned that loud.", ephemeral: true });
                    } else {
                        return interaction.reply({ content: "That's not banned.", ephemeral: true });
                    }

                case 'count':
                    return await showCount(Louds, interaction);

                case 'list':
                    return await showList(Louds, interaction);

                case 'deletematch':
                    return await deleteMatchWithConfirmation(Louds, interaction, pattern!, log);

                default:
                    return interaction.reply({ content: "I don't recognize that command.", ephemeral: true });
            }
        } catch (error: any) {
            // Don't log or respond if it's an authorization error (already handled)
            if (error?.message === 'Unauthorized: User is not bot owner') {
                return;
            }
            log.error({ error, subcommand, text }, 'Error executing louds command');
            if (!interaction.replied) {
                const errorMsg = "Sorry, there was an error processing your request. Please try again.";
                return interaction.reply({ content: errorMsg, ephemeral: true });
            }
        }
    },
};

const removeWithConfirmation = async (model: any, interaction: ChatInputCommandInteraction, text: string, log: any) => {
    // Check if the loud exists first
    const loud = await model.findOne({ where: { message: text } });
    if (!loud) {
        return interaction.reply({ content: "I couldn't find that loud.", ephemeral: true });
    }

    const truncated = text.length > 50 ? text.substring(0, 47) + '...' : text;

    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_delete')
        .setLabel('Delete')
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_delete')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

    const response = await interaction.reply({
        content: `Are you sure you want to delete this loud?\n\`${truncated}\``,
        components: [row],
        ephemeral: true,
    });

    try {
        const confirmation = await response.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30_000, // 30 seconds to respond
        });

        if (confirmation.customId === 'confirm_delete') {
            const rowCount = await model.destroy({ where: { message: text } });
            if (rowCount) {
                await confirmation.update({ content: "I've removed that loud.", components: [] });
            } else {
                await confirmation.update({ content: "I couldn't find that loud.", components: [] });
            }
        } else {
            await confirmation.update({ content: "Deletion cancelled.", components: [] });
        }
    } catch (error) {
        log.debug('Loud delete confirmation timed out');
        await interaction.editReply({ content: "Confirmation timed out. Deletion cancelled.", components: [] });
    }
};

const deleteMatchWithConfirmation = async (
    model: any, interaction: ChatInputCommandInteraction, pattern: string, log: any,
) => {
    // Find matching louds
    const matches = await model.findAll({
        where: {
            message: {
                [Op.like]: `%${pattern}%`,
            },
        },
    });

    if (matches.length === 0) {
        return interaction.reply({ content: `No louds found matching "${pattern}".`, ephemeral: true });
    }

    const confirmButton = new ButtonBuilder()
        .setCustomId('confirm_deletematch')
        .setLabel(`Delete ${matches.length} loud${matches.length !== 1 ? 's' : ''}`)
        .setStyle(ButtonStyle.Danger);

    const cancelButton = new ButtonBuilder()
        .setCustomId('cancel_deletematch')
        .setLabel('Cancel')
        .setStyle(ButtonStyle.Secondary);

    const row = new ActionRowBuilder<ButtonBuilder>()
        .addComponents(confirmButton, cancelButton);

    // Show preview of what will be deleted (up to 5 examples)
    let preview = matches.slice(0, 5).map((loud: { message: string }) => {
        const truncated = loud.message.length > 50 ? loud.message.substring(0, 47) + '...' : loud.message;
        return `• \`${truncated}\``;
    }).join('\n');

    if (matches.length > 5) {
        preview += `\n... and ${matches.length - 5} more`;
    }

    const response = await interaction.reply({
        content: `Found **${matches.length}** loud${matches.length !== 1 ? 's' : ''} ` +
            `matching "${pattern}":\n${preview}\n\nAre you sure you want to delete all of them?`,
        components: [row],
        ephemeral: true,
    });

    try {
        const confirmation = await response.awaitMessageComponent({
            componentType: ComponentType.Button,
            time: 30_000, // 30 seconds to respond
        });

        if (confirmation.customId === 'confirm_deletematch') {
            const rowCount = await model.destroy({
                where: {
                    message: {
                        [Op.like]: `%${pattern}%`,
                    },
                },
            });
            const deleteMsg = `Deleted **${rowCount}** loud${rowCount !== 1 ? 's' : ''} matching "${pattern}".`;
            await confirmation.update({ content: deleteMsg, components: [] });
        } else {
            await confirmation.update({ content: "Deletion cancelled.", components: [] });
        }
    } catch (error) {
        log.debug('Loud deletematch confirmation timed out');
        await interaction.editReply({ content: "Confirmation timed out. Deletion cancelled.", components: [] });
    }
};

const add = async (model: any, interaction: ChatInputCommandInteraction) => {
    const text = interaction.options.getString('text');
    // Use findOrCreate to handle race conditions atomically
    await model.findOrCreate({
        where: { message: text },
        defaults: {
            message: text,
            username: interaction.user.id,
        },
    });
};

const showCount = async (Louds: any, interaction: ChatInputCommandInteraction) => {
    const count = await Louds.count();
    const message = count === 1 ? "I have **1** loud stored." : `I have **${count}** louds stored.`;
    return interaction.reply({ content: message, ephemeral: true });
};

const showList = async (Louds: any, interaction: ChatInputCommandInteraction) => {
    const limit = interaction.options.getInteger('limit') || 10;
    const louds = await Louds.findAll({
        limit: Math.min(limit, 50), // Cap at 50 to avoid spam
        order: [['createdAt', 'DESC']], // Most recent first
    });

    if (louds.length === 0) {
        return interaction.reply({ content: "I don't have any louds stored yet.", ephemeral: true });
    }

    let response = `**${louds.length}** recent loud${louds.length !== 1 ? 's' : ''}:\n`;
    louds.forEach((loud: { message: string }, index: number) => {
        const truncated = loud.message.length > 100 ? loud.message.substring(0, 97) + '...' : loud.message;
        response += `${index + 1}. "${truncated}"\n`;
    });

    return interaction.reply({ content: response, ephemeral: true });
};

export default loudsCommand;
