const { isEmpty } = require('lodash');
const { SlashCommandBuilder } = require("discord.js");
const { Op } = require("sequelize");
// To set or remove configurations.
// Commands:
//   config add key value
//   config remove key value

module.exports = {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Add or remove configurations.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Add a configuration.')
                .addStringOption(option =>
                    option
                        .setName('key')
                        .setDescription('The configuration key.')
                        .setRequired(true))
                .addStringOption(option =>
                    option
                        .setName('value')
                        .setDescription('The configuration value.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('remove')
                .setDescription('Remove a configuration.')
                .addStringOption(option =>
                    option
                        .setName('key')
                        .setDescription('The configuration key.')
                        .setAutocomplete(true)
                        .setRequired(true))),
    async autocomplete(interaction, { Config }) {
        if (interaction.options.getSubcommand() === 'remove') {
            const keyFragment = interaction.options.getFocused()
            const records = await Config.findAll({
                where: {
                    key: {
                        [Op.like]: `${keyFragment}%` // Op.like for partial matches, requires Sequelize Op import
                    }
                }
            });
            const choices = records.map(record => ({ name: record.key, value: record.key }));
            await interaction.respond(choices);
        }
    },
    async execute(interaction, { Config, log }) {
        const subcommand = interaction.options.getSubcommand();
        const key = interaction.options.getString('key');
        const value = subcommand === 'add' ? interaction.options.getString('value') : null;

        try {
            if (subcommand === 'add') {
                if (isEmpty(key) || isEmpty(value)) {
                    throw new Error('Key and value are required for adding a config.');
                }
                const [record, created] = await Config.upsert({ key, value });
                const replyMessage = created ? `Configuration for \`${key}\` has been added.` : `Configuration for \`${key}\` has been updated.`;
                await interaction.reply({ content: replyMessage, ephemeral: true });
            } else if (subcommand === 'remove') {
                const record = await Config.findOne({ where: { key } });
                if (!record) {
                    throw new Error(`No configuration found for key \`${key}\`.`);
                }
                await record.destroy();
                await interaction.reply({ content: `Configuration for \`${key}\` has been removed.`, ephemeral: true });
            }
        } catch (error) {
            // Log the error for debugging purposes
            log.error('Error executing config command:', error);
            // Respond to the user with a friendly message
            await interaction.reply({ content: `An error occurred: ${error.message}`, ephemeral: true });
        }
    }
};
