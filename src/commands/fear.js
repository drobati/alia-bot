const { SlashCommandBuilder } = require('discord.js');
const { stripIndent } = require('common-tags');

module.exports = {
    // Litany Against Fear
    data: new SlashCommandBuilder()
        .setName('fear')
        .setDescription('Litany Against Fear'),
    async execute(interaction) {
        await interaction.reply({
            context: stripIndent`
                I must not fear.
                Fear is the mind-killer.
                Fear is the little-death that brings total obliteration.
                I will face my fear.
                I will permit it to pass over me and through me.
                And when it has gone past, I will turn the inner eye to see its path.
                Where the fear has gone there will be nothing. Only I will remain.
                `,
            ephemeral: true,
        });
    },
};
