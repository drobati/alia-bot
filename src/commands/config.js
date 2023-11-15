const { isEmpty } = require('lodash');
const { SlashCommandBuilder } = require("discord.js");
const { Op } = require("sequelize");
// To set or remove configurations.
// Commands:
//   config add key value
//   config remove key value

async function handleAddCommand(interaction, context) {
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');

    if (isEmpty(key) || isEmpty(value)) {
        throw new Error('Key and value are required for adding a config.');
    }

    // Prevent concurrent writes to the same key.
    const result = await context.sequelize.transaction(async (transaction) => {
        const [, created] = await context.tables.Config.upsert({ key, value }, { transaction });
        return created;
    });

    const replyMessage = result ? `Configuration for \`${key}\` has been added.` : `Configuration for \`${key}\` has been updated.`;
    await interaction.reply({ content: replyMessage, ephemeral: true });
}


async function handleRemoveCommand(interaction, context) {
    const key = interaction.options.getString('key');

    await context.sequelize.transaction(async (transaction) => {
        const record = await context.tables.Config.findOne({ where: { key }, transaction });
        if (!record) {
            throw new Error(`No configuration found for key \`${key}\`.`);
        }
        await record.destroy({ transaction });
    });

    await interaction.reply({ content: `Configuration for \`${key}\` has been removed.`, ephemeral: true });
}

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
    async autocomplete(interaction, { tables }) {
        const { Config } = tables;
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
    async execute(interaction, context) {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        try {
            if (subcommand === 'add') {
                await handleAddCommand(interaction, context);
            } else if (subcommand === 'remove') {
                await handleRemoveCommand(interaction, context);
            }
        } catch (error) {
            log.error('Error executing config command:', error);
            await interaction.reply({ content: `An error occurred: ${error.message}`, ephemeral: true });
        }
    }
};
