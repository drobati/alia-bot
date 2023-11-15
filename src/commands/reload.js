const { SlashCommandBuilder } = require('discord.js');

function validateCommand(interaction, commandName) {
    const command = interaction.client.commands.get(commandName);
    if (!command) {
        interaction.reply(`There is no command with name \`${commandName}\`!`);
        return false;
    }
    return true;
}

async function reloadCommand(client, commandName, log) {
    delete require.cache[require.resolve(`./${commandName}.js`)];
    await client.commands.delete(commandName);
    log.info(`Command \`${commandName}\` was deleted.`);

    const newCommand = require(`./${commandName}.js`);
    await client.commands.set(newCommand.data.name, newCommand);
    log.info(`Command \`${newCommand.data.name}\` was added.`);
}

module.exports = {
    data: new SlashCommandBuilder()
        .setName('reload')
        .setDescription('Reloads a command.')
        .addStringOption(option =>
            option.setName('command')
                .setDescription('The command to reload.')
                .setRequired(true)),
    async execute(interaction, { log }) {
        const commandName = interaction.options.getString('command', true).toLowerCase();

        if (!validateCommand(interaction, commandName)) {
            return;
        }

        try {
            await reloadCommand(interaction.client, commandName, log);
            await interaction.reply(`Command \`${commandName}\` was reloaded!`);
        } catch (error) {
            log.error(`Error while reloading command \`${commandName}\`: ${error}`);
            await interaction.reply(`There was an error while reloading command \`${commandName}\`: ${error.message}`);
        }
    },
};
