const { SlashCommandBuilder } = require('discord.js');
const { literal } = require('sequelize');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('remember')
        .setDescription('Memory management for the bot.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('get')
                .setDescription('Returns a remembered value.')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to get the memory for')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('add')
                .setDescription('Remembers a new key and value.')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to remember')
                        .setRequired(true))
                .addStringOption(option =>
                    option.setName('value')
                        .setDescription('The value to remember')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('delete')
                .setDescription('Removes a key from memory.')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to delete')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('top')
                .setDescription('Returns the top remembered keys.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('The number of top keys to return')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('random')
                .setDescription('Returns random remembered keys.')
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('The number of random keys to return')
                        .setRequired(false)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('trigger')
                .setDescription('Flags a key as triggered.')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to trigger')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('untrigger')
                .setDescription('Unflags a triggered key.')
                .addStringOption(option =>
                    option.setName('key')
                        .setDescription('The key to untrigger')
                        .setRequired(true))),
    async execute(interaction, { tables }) {
        const { Memories } = tables;
        const subcommand = interaction.options.getSubcommand();
        const key = interaction.options.getString('key');
        let value = interaction.options.getString('value');
        let amount = interaction.options.getInteger('amount');

        switch (subcommand) {
            case 'get':
                await getMemory({ interaction, Memories, key });
                break;
            case 'add':
                value = interaction.options.getString('value');
                await upsertMemory({ interaction, Memories, key, value });
                break;
            case 'delete':
                await removeMemory({ interaction, Memories, key });
                break;
            case 'top':
                amount = interaction.options.getInteger('amount') || 5;
                await getTopMemories({ interaction, Memories, amount });
                break;
            case 'random':
                amount = interaction.options.getInteger('amount') || 1;
                await getRandomMemories({ interaction, Memories, amount });
                break;
            case 'trigger':
                await flagTriggered({ interaction, Memories, key, triggered: true });
                break;
            case 'untrigger':
                await flagTriggered({interaction, Memories, key, triggered: false});
                break;
            default:
                await interaction.reply("I don't recognize that command.");
        }
    }
};

const upsertMemory = async ({ interaction, Memories, key, value }) => {
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        const oldValue = record.value;
        await record.update({ value });
        await interaction.reply(`"${key}" is now "${value}" (previously: "${oldValue}").`);
    } else {
        await Memories.create({ key, value });
        await interaction.reply(`"${key}" is now "${value}".`);
    }
};

const getMemory = async ({ interaction, Memories, key }) => {
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        await interaction.reply(`"${key}" is "${record.value}".`);
    } else {
        await interaction.reply(`I can't remember "${key}".`);
    }
};

const removeMemory = async ({ interaction, Memories, key }) => {
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        await record.destroy();
        await interaction.reply(`Forgotten: "${key}".`);
    } else {
        await interaction.reply(`I can't remember "${key}" to forget it.`);
    }
};

const getTopMemories = async ({ interaction, Memories, amount }) => {
    const records = await Memories.findAll({
        order: [['read_count', 'DESC']],
        limit: amount
    });
    if (records.length > 0) {
        let response = `Top ${amount} Memories:\n`;
        records.forEach((record) => {
            response += ` * "${record.key}" - Accessed ${record.read_count} times\n`;
        });
        await interaction.reply(response);
    } else {
        await interaction.reply("I can't remember anything.");
    }
};

const getRandomMemories = async ({ interaction, Memories, amount }) => {
    const records = await Memories.findAll({
        order: literal('RAND()'),
        limit: amount
    });
    if (records.length > 0) {
        let response = `Random ${amount} Memories:\n`;
        records.forEach((record) => {
            response += ` * "${record.key}" - "${record.value}"\n`;
        });
        await interaction.reply(response);
    } else {
        await interaction.reply("I can't remember anything.");
    }
};

const flagTriggered = async ({ interaction, Memories, key, triggered }) => {
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        await record.update({ triggered });
        const triggeredStatus = triggered ? 'triggered' : 'untriggered';
        await interaction.reply(`"${key}" is now ${triggeredStatus}.`);
    } else {
        await interaction.reply(`I can't remember "${key}" to trigger it.`);
    }
};
