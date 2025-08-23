import axios from "axios";
import { SlashCommandBuilder, ChatInputCommandInteraction } from "discord.js";
import { get } from "lodash";
import { Context } from "../types";

const dadJokeCommand = {
    data: new SlashCommandBuilder()
        .setName('dadjoke')
        .setDescription('Get a random dad joke.'),
    async execute(interaction: ChatInputCommandInteraction, {
        log,
    }: Context) {
        try {
            const response = await axios.get('https://icanhazdadjoke.com/', {
                headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
            });

            const joke = get(response, 'data.joke', 'No joke. Seriously.');
            return await interaction.reply(joke);
        } catch (error) {
            log.error({ error }, 'Error fetching joke');
            return await interaction.reply('Sorry, I could not fetch a joke at this time.');
        }
    },
};

export default dadJokeCommand;
