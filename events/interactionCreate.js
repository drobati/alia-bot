const { Events } = require('discord.js');

module.exports = {
    name: Events.InteractionCreate,
    async execute(interaction, context) {
        const { log } = context;

        if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
            log.error(`Interaction ${interaction.commandName} is not a chat input command or autocomplete`);
            return;
        }

        const command = interaction.client.commands.get(interaction.commandName);

        if (!command) {
            log.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            if (interaction.isAutocomplete()) {
                log.info(`Autocompleting ${interaction.commandName}`);
                await command.autocomplete(interaction, context);
            } else if (interaction.isCommand()) {
                log.info(`Executing ${interaction.commandName}`);
                await command.execute(interaction, context);
            }
        } catch (error) {
            log.error(error);
            if (interaction.replied || interaction.deferred) {
                await interaction.followUp({
                    content: 'There was an error while executing this command!',
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: 'There was an error while executing this command!',
                    ephemeral: true,
                });
            }
        }
    },
};
