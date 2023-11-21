const axios = require('axios');
const { SlashCommandBuilder } = require('discord.js');
const { get } = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dadjoke')
        .setDescription('Get a random dad joke.'),
    async execute(interaction, { log }) {
        try {
            const response = await axios.get('https://icanhazdadjoke.com/', {
                headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
            });

            const joke = get(response, 'data.joke', 'No joke. Seriously.');
            return await interaction.reply(joke);
        } catch (error) {
            log.error(`Error fetching joke: ${error.message}`);
            return await interaction.reply('Sorry, I couldn’t fetch a joke at this time.');
        }
    } };
