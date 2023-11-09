const { SlashCommandBuilder } = require('discord.js');

module.exports = {
    // Litany Against Fear
    data: new SlashCommandBuilder()
        .setName('fear')
        .setDescription('Litany Against Fear'),
    async execute(interaction) {
        await interaction.reply('I must not fear.\n' +
            'Fear is the mind-killer.\n' +
            'Fear is the little-death that brings total obliteration.\n' +
            'I will face my fear.\n' +
            'I will permit it to pass over me and through me.\n' +
            'And when it has gone past, I will turn the inner eye to see its path.\n' +
            'Where the fear has gone there will be nothing. Only I will remain.');
    },
};
