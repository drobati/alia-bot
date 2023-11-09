// Description:
//   You are a ____.
//   So ____ maybe you should _____,
//   but perhaps ____.
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   adlib add [TEXT]    - Add an adlib to the database.
//   adlib delete [TEXT] - Delete an adlib from the database.
//
// Author:
//   derek r
const {SlashCommandBuilder} = require("discord.js");

module.exports = {
    data: new SlashCommandBuilder()
        .setName('adlibs')
        .setDescription('Add or remove adlibs.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add an adlib.')
                .addStringOption(option =>
                    option
                        .setName('adlib')
                        .setDescription('The adlib to add.')))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove an adlib.')
                .addStringOption(option =>
                    option
                        .setName('adlib')
                        .setDescription('The adlib to remove.'))),
    async execute(interaction, context) {
        const {Adlibs} = context;
        const value = interaction.options.getString('adlib');
        const record = await Adlibs.findOne({where: {value}});
        switch (interaction.options.getSubcommand()) {
            case 'add':
                if (!record) {
                    await Adlibs.create({value});
                    return await interaction.reply("I've added that adlib.");
                } else {
                    return await interaction.reply('That adlib already exists.');
                }

            case 'remove':
                if (record) {
                    await record.destroy({force: true});
                    return await interaction.reply("I've removed that adlib.");
                }
                return await interaction.reply("I don't recognize that adlib.");

            default:
                return await interaction.reply("I don't recognize that command.");
        }
    }
};
