const { SlashCommandBuilder } = require('discord.js');
const { Op } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('loud')
        .setDescription('Manage loud messages.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Delete the loud with the matching text.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('The text of the loud to delete.')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('ban')
                .setDescription('Forbid a certain loud.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('The text of the loud to ban.')
                        .setRequired(true)
                        .setAutocomplete(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unban')
                .setDescription('Remove a forbidden loud.')
                .addStringOption(option =>
                    option.setName('text')
                        .setDescription('The text of the loud to unban.')
                        .setRequired(true)
                        .setAutocomplete(true))),
    async autocomplete(interaction, { Louds, Louds_Banned: Banned, log }) {
        const subcommand = interaction.options.getSubcommand();
        const focusedOption = interaction.options.getFocused(true);

        let choices = [];
        if (focusedOption.name === 'text') {
            const searchText = focusedOption.value;

            if (subcommand === 'delete' || subcommand === 'ban') {
                // For delete and ban commands, we only want to autocomplete with existing louds
                const loudSearch = await Louds.findAll({
                    where: {
                        message: {
                            [Op.like]: `${searchText}%` // Use "like" operator for partial matches
                        }
                    },
                    limit: 25
                });
                choices = loudSearch.map(record => ({
                    name: record.message,
                    value: record.message
                }));
            } else if (subcommand === 'unban') {
                // For unban command, we only want to autocomplete with banned louds
                const bannedSearch = await Banned.findAll({
                    where: {
                        message: {
                            [Op.like]: `${searchText}%` // Use "like" operator for partial matches
                        }
                    },
                    limit: 25
                });
                choices = bannedSearch.map(record => ({
                    name: record.message,
                    value: record.message
                }));
            }

            log.info({ subcommand, searchText, choices }, 'Autocomplete search results');
        }
        await interaction.respond(choices.slice(0, 25));
    },
    async execute(interaction, { Louds, Louds_Banned: Banned, log }) {
        const subcommand = interaction.options.getSubcommand();
        const text = interaction.options.getString('text');

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

            default:
                return interaction.reply("I don't recognize that command.");
        }
    }
};

const remove = async (model, interaction, response) => {
    const text = interaction.options.getString('text');
    const rowCount = await model.destroy({ where: { message: text } });
    if (!rowCount) {
        return interaction.reply("I couldn't find that loud.");
    }
    return interaction.reply(response);
};

const add = async (model, interaction) => {
    const text = interaction.options.getString('text');
    const exists = await model.findOne({ where: { message: text } });
    if (!exists) {
        await model.create({
            message: text,
            username: interaction.user.id
        });
    }
};
