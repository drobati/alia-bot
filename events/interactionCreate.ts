import { CommandInteraction, Events, Interaction } from "discord.js";
import { Command, Context, BotEvent, ExtendedClient } from "../src/utils/types";

const interactionCreateEventHandler: BotEvent = {
    name: Events.InteractionCreate,
    async execute(interaction: Interaction, context: Context) {
        const { log } = context;

        if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
            log.error(`Interaction type ${interaction.type}} is not a chat input command or autocomplete`);
            return;
        }

        const command = (interaction.client as ExtendedClient).commands
            .get(interaction.commandName) as Command | undefined;

        if (!command) {
            log.error(`No command matching ${interaction.commandName} was found.`);
            return;
        }

        try {
            if (interaction.isAutocomplete()) {
                if (command && command.autocomplete) {
                    log.info(`Autocompleting ${interaction.commandName}`);
                    await command.autocomplete(interaction, context);
                } else {
                    log.error(`Autocomplete command not found for ${interaction.commandName}`);
                }
            }
            else if (interaction.isCommand()) {
                log.info(`Executing ${interaction.commandName}`);
                await command.execute(interaction, context);
            }
        } catch (error) {
            log.error(error);
            if (interaction instanceof CommandInteraction) {
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
            } else {
                log.error('Interaction type does not support replied or deferred properties.');
            }
        }
    },
};
export default interactionCreateEventHandler;
