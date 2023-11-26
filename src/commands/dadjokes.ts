import axios from "axios";
import { SlashCommandBuilder } from "discord.js";

import { get } from "lodash";

export default {
    data: new SlashCommandBuilder()
        .setName('dadjoke')
        .setDescription('Get a random dad joke.'),
    async execute(interaction: any, {
        log,
    }: any) {
        try {
            const response = await axios.get('https://icanhazdadjoke.com/', {
                headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
            });

            const joke = get(response, 'data.joke', 'No joke. Seriously.');
            return await interaction.reply(joke);
        } catch (error) {
            // @ts-expect-error TS(2571): Object is of type 'unknown'.
            log.error(`Error fetching joke: ${error.message}`);
            return await interaction.reply('Sorry, I couldn’t fetch a joke at this time.');
        }
    } };
