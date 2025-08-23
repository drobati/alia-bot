import {
    SlashCommandBuilder,
    AutocompleteInteraction,
    ChatInputCommandInteraction,
    SlashCommandSubcommandBuilder,
    SlashCommandStringOption,
    SlashCommandIntegerOption,
} from "discord.js";
import { Op } from "sequelize";
import { Context, AutocompleteChoice } from "../types";

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
                .setRequired(false))),
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
    async execute(interaction: ChatInputCommandInteraction, {
        tables,
        log,
    }: Context) {
        const { Louds, Louds_Banned: Banned } = tables;
        const subcommand = interaction.options.getSubcommand();
        const text = interaction.options.getString('text');

        try {
            switch (subcommand) {
                case 'delete':
                    return await remove(Louds, interaction, "I've removed that loud.");

                case 'ban':
                    await add(Banned, interaction);
                    if (await Louds.findOne({ where: { message: text } })) {
                        return await remove(Louds, interaction, "I've removed & banned that loud.");
                    }
                    return interaction.reply("I've banned that loud.");

                case 'unban':
                    if (await Banned.findOne({ where: { message: text } })) {
                        await add(Louds, interaction);
                        return await remove(Banned, interaction, "I've added & unbanned that loud.");
                    } else {
                        return interaction.reply("That's not banned.");
                    }

                case 'count':
                    return await showCount(Louds, interaction);

                case 'list':
                    return await showList(Louds, interaction);

                default:
                    return interaction.reply("I don't recognize that command.");
            }
        } catch (error) {
            log.error({ error, subcommand, text }, 'Error executing louds command');
            return interaction.reply("Sorry, there was an error processing your request. Please try again.");
        }
    },
};

const remove = async (model: any, interaction: ChatInputCommandInteraction, response: string) => {
    const text = interaction.options.getString('text');
    const rowCount = await model.destroy({ where: { message: text } });
    if (!rowCount) {
        return interaction.reply("I couldn't find that loud.");
    }
    return interaction.reply(response);
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
    return interaction.reply(message);
};

const showList = async (Louds: any, interaction: ChatInputCommandInteraction) => {
    const limit = interaction.options.getInteger('limit') || 10;
    const louds = await Louds.findAll({
        limit: Math.min(limit, 50), // Cap at 50 to avoid spam
        order: [['createdAt', 'DESC']], // Most recent first
    });

    if (louds.length === 0) {
        return interaction.reply("I don't have any louds stored yet.");
    }

    let response = `**${louds.length}** recent loud${louds.length !== 1 ? 's' : ''}:\n`;
    louds.forEach((loud: { message: string }, index: number) => {
        const truncated = loud.message.length > 100 ? loud.message.substring(0, 97) + '...' : loud.message;
        response += `${index + 1}. "${truncated}"\n`;
    });

    return interaction.reply(response);
};

export default loudsCommand;
