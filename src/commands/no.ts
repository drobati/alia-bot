import axios from "axios";
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { get } from "lodash";
import { Context } from "../types";

const noCommand = {
    data: new SlashCommandBuilder()
        .setName('no')
        .setDescription('Get a random rejection reason from No-as-a-Service.'),
    async execute(interaction: ChatInputCommandInteraction, {
        log,
    }: Context) {
        try {
            const response = await axios.get('https://naas.isalman.dev/no', {
                headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
            });

            const reason = get(response, 'data.reason', 'No.');
            return await interaction.reply(reason);
        } catch (error) {
            log.error({ error }, 'Error fetching rejection reason');
            return await interaction.reply('No. (And the API is down too.)');
        }
    },
};

export default noCommand;
