import { isEmpty } from "lodash";
import { SlashCommandBuilder } from "discord.js";
import { Op } from "sequelize";
import { checkOwnerPermission, isOwner } from "../utils/permissions";
// To set or remove configurations.
// Commands:
//   config add key value
//   config remove key value

async function handleAddCommand(interaction: any, context: any) {
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');

    if (isEmpty(key) || isEmpty(value)) {
        throw new Error('Key and value are required for adding a config.');
    }

    // Prevent concurrent writes to the same key.
    const result = await context.sequelize.transaction(async (transaction: any) => {
        const [, created] = await context.tables.Config.upsert({ key, value }, { transaction });
        return created;
    });

    const replyMessage = result ?
        `Configuration for \`${key}\` has been added.` :
        `Configuration for \`${key}\` has been updated.`;
    await interaction.reply({ content: replyMessage, ephemeral: true });
}

async function handleRemoveCommand(interaction: any, context: any) {
    const key = interaction.options.getString('key');

    await context.sequelize.transaction(async (transaction: any) => {
        const record = await context.tables.Config.findOne({ where: { key }, transaction });
        if (!record) {
            throw new Error(`No configuration found for key \`${key}\`.`);
        }
        await record.destroy({ transaction });
    });

    await interaction.reply({ content: `Configuration for \`${key}\` has been removed.`, ephemeral: true });
}

export default {
    data: new SlashCommandBuilder()
        .setName('config')
        .setDescription('Add or remove configurations.')
        .addSubcommand((subcommand: any) => subcommand
            .setName('add')
            .setDescription('Add a configuration.')
            .addStringOption((option: any) => option
                .setName('key')
                .setDescription('The configuration key.')
                .setRequired(true))
            .addStringOption((option: any) => option
                .setName('value')
                .setDescription('The configuration value.')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('remove')
            .setDescription('Remove a configuration.')
            .addStringOption((option: any) => option
                .setName('key')
                .setDescription('The configuration key.')
                .setAutocomplete(true)
                .setRequired(true))),
    async autocomplete(interaction: any, context: any) {
        const { tables } = context;
        const { Config } = tables;

        // Only show autocomplete options to owner
        if (!isOwner(interaction.user.id)) {
            await interaction.respond([]);
            return;
        }

        if (interaction.options.getSubcommand() === 'remove') {
            const keyFragment = interaction.options.getFocused()
            const records = await Config.findAll({
                where: {
                    key: {
                        [Op.like]: `${keyFragment}%`, // Op.like for partial matches, requires Sequelize Op import
                    },
                },
            });
            const choices = records.map((record: any) => ({
                name: record.key,
                value: record.key,
            }));
            await interaction.respond(choices);
        }
    },
    async execute(interaction: any, context: any) {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        try {
            // Restrict config command to bot owner only
            await checkOwnerPermission(interaction, context);

            if (subcommand === 'add') {
                await handleAddCommand(interaction, context);
            } else if (subcommand === 'remove') {
                await handleRemoveCommand(interaction, context);
            }
        } catch (error) {
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            if (error.message?.includes('Unauthorized')) {
                log.info('Unauthorized config command attempt', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                return; // Reply already sent in checkOwnerPermission
            }

            log.error('Error executing config command:', error);
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            await interaction.reply({ content: `An error occurred: ${error.message}`, ephemeral: true });
        }
    },
};
