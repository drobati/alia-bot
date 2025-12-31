import { SlashCommandBuilder } from "discord.js";
import { triggerCache } from '../utils/triggerCache';
import { literal } from "sequelize";

export default {
    data: new SlashCommandBuilder()
        .setName('remember')
        .setDescription('Memory management for the bot.')
        .addSubcommand((subcommand: any) => subcommand
            .setName('get')
            .setDescription('Returns a remembered value.')
            .addStringOption((option: any) => option.setName('key')
                .setDescription('The key to get the memory for')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('add')
            .setDescription('Remembers a new key and value.')
            .addStringOption((option: any) => option.setName('key')
                .setDescription('The key to remember')
                .setRequired(true))
            .addStringOption((option: any) => option.setName('value')
                .setDescription('The value to remember')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('delete')
            .setDescription('Removes a key from memory.')
            .addStringOption((option: any) => option.setName('key')
                .setDescription('The key to delete')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('top')
            .setDescription('Returns the top remembered keys.')
            .addIntegerOption((option: any) => option.setName('amount')
                .setDescription('The number of top keys to return')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('random')
            .setDescription('Returns random remembered keys.')
            .addIntegerOption((option: any) => option.setName('amount')
                .setDescription('The number of random keys to return')
                .setRequired(false)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('trigger')
            .setDescription('Flags a key as triggered.')
            .addStringOption((option: any) => option.setName('key')
                .setDescription('The key to trigger')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('untrigger')
            .setDescription('Unflags a triggered key.')
            .addStringOption((option: any) => option.setName('key')
                .setDescription('The key to untrigger')
                .setRequired(true))),
    async execute(interaction: any, context: any) {
        switch (interaction.options.getSubcommand()) {
            case 'get':
                await getMemory(interaction, context);
                break;
            case 'add':
                await upsertMemory(interaction, context);
                break;
            case 'delete':
                await removeMemory(interaction, context);
                break;
            case 'top':
                await getTopMemories(interaction, context);
                break;
            case 'random':
                await getRandomMemories(interaction, context);
                break;
            case 'trigger':
                await flagTriggered(interaction, context, true);
                break;
            case 'untrigger':
                await flagTriggered(interaction, context, false);
                break;
            default:
                await interaction.reply({ content: "I don't recognize that command.", ephemeral: true });
        }
    },
};

const upsertMemory = async (interaction: any, context: any) => {
    const key = interaction.options.getString('key');
    const value = interaction.options.getString('value');

    // Get old value for response message
    const existingRecord = await context.tables.Memories.findOne({ where: { key } });
    const oldValue = existingRecord?.value;

    // Use upsert for atomic operation
    const [record, created] = await context.tables.Memories.upsert(
        { key, value },
        { returning: true },
    );

    // Update cache if this is a triggered memory
    if (record.triggered) {
        triggerCache.addTrigger(key, value);
    }

    if (created) {
        await interaction.reply({ content: `"${key}" is now "${value}".`, ephemeral: true });
    } else {
        await interaction.reply({ content: `"${key}" is now "${value}" (previously: "${oldValue}").`, ephemeral: true });
    }
};

const getMemory = async (interaction: any, context: any) => {
    const key = interaction.options.getString('key');
    const record = await context.tables.Memories.findOne({ where: { key } });
    if (record) {
        await interaction.reply({ content: `"${key}" is "${record.value}".`, ephemeral: true });
    } else {
        await interaction.reply({ content: `I can't remember "${key}".`, ephemeral: true });
    }
};

const removeMemory = async (interaction: any, context: any) => {
    const key = interaction.options.getString('key');
    const record = await context.tables.Memories.findOne({ where: { key } });
    if (record) {
        try {
            // First destroy the record
            await record.destroy();

            // Only remove from cache after successful database deletion
            if (record.triggered) {
                triggerCache.removeTrigger(key);
            }

            await interaction.reply({ content: `Forgotten: "${key}".`, ephemeral: true });
        } catch (error) {
            context.log?.error({ error, key }, 'Failed to delete memory record');
            await interaction.reply({ content: `Failed to forget "${key}". Please try again.`, ephemeral: true });
        }
    } else {
        await interaction.reply({ content: `I can't remember "${key}" to forget it.`, ephemeral: true });
    }
};

const getTopMemories = async (interaction: any, context: any) => {
    const amount = interaction.options.getInteger('amount') || 5;
    const records = await context.tables.Memories.findAll({
        order: [['read_count', 'DESC']],
        limit: amount,
    });
    if (records.length > 0) {
        let response = `Top ${amount} Memories:\n`;
        records.forEach((record: any) => {
            response += ` * "${record.key}" - Accessed ${record.read_count} times\n`;
        });
        await interaction.reply({ content: response, ephemeral: true });
    } else {
        await interaction.reply({ content: "I can't remember anything.", ephemeral: true });
    }
};

const getRandomMemories = async (interaction: any, context: any) => {
    const amount = interaction.options.getInteger('amount') || 5;
    const records = await context.tables.Memories.findAll({
        order: literal('RAND()'),
        limit: amount,
    });
    if (records.length > 0) {
        let response = `Random ${amount} Memories:\n`;
        records.forEach((record: any) => {
            response += ` * "${record.key}" - "${record.value}"\n`;
        });
        await interaction.reply({ content: response, ephemeral: true });
    } else {
        await interaction.reply({ content: "I can't remember anything.", ephemeral: true });
    }
};

const flagTriggered = async (interaction: any, context: any, triggered: any) => {
    const key = interaction.options.getString('key');
    const record = await context.tables.Memories.findOne({ where: { key } });
    if (record) {
        await record.update({ triggered });

        // Update trigger cache
        triggerCache.updateTriggerStatus(key, triggered, record.value);

        const triggeredStatus = triggered ? 'triggered' : 'untriggered';
        await interaction.reply({ content: `"${key}" is now ${triggeredStatus}.`, ephemeral: true });
    } else {
        await interaction.reply({ content: `I can't remember "${key}" to trigger it.`, ephemeral: true });
    }
};
