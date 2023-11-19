// Description:
//   You are a ---.
//   So --- maybe you should ---,
//   but perhaps ---.
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
const { SlashCommandBuilder } = require("discord.js");

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
    async autocomplete(interaction, context) {
        if (interaction.options.getSubcommand() === 'remove') {
            const focusedOption = interaction.options.getFocused(true);
            const searchQuery = focusedOption.value;

            try {
                const suggestions = await context.tables.Adlibs.findAll({
                    where: {
                        value: {
                            [context.Sequelize.Op.like]: `%${searchQuery}%`,
                        },
                    },
                    limit: 25, // limit the number of suggestions
                });

                const choices = suggestions.map(adlib => ({ name: adlib.value, value: adlib.value }));
                await interaction.respond(choices);
            } catch (error) {
                context.log.error('Error fetching adlib suggestions:', error);
            }
        }
    },
    async execute(interaction, context) {
        const subcommand = interaction.options.getSubcommand();
        switch (subcommand) {
            case 'add':
                return await addAdlib(interaction, context);
            case 'remove':
                return await removeAdlib(interaction, context);
            default:
                return await interaction.reply("I don't recognize that command.");
        }
    },
};

async function addAdlib(interaction, context) {
    try {
        const value = interaction.options.getString('adlib');
        const record = await context.tables.Adlibs.findOne({ where: { value } });
        if (!record) {
            await context.tables.Adlibs.create({ value });
            return interaction.reply("I've added that adlib.");
        } else {
            return interaction.reply('That adlib already exists.');
        }
    } catch (error) {
        context.log.error('Error adding adlib:', error);
        return interaction.reply('There was an error adding that adlib.');
    }
}

async function removeAdlib(interaction, context) {
    try {
        const value = interaction.options.getString('adlib');
        const record = await context.tables.Adlibs.findOne({ where: { value } });
        if (record) {
            await record.destroy({ force: true });
            return interaction.reply("I've removed that adlib.");
        }
        return interaction.reply("I don't recognize that adlib.");
    } catch (error) {
        context.log.error('Error removing adlib:', error);
        return interaction.reply('There was an error removing that adlib.');
    }
}
