const axios = require('axios');
const { SlashCommandBuilder } = require('discord.js');
const { get } = require('lodash');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('dadjoke')
        .setDescription('Get a random dad joke.'),
    async execute(interaction) {
        const joke = get(
            // We have to return a different useragent, otherwise the server will block us
            await axios.get('https://icanhazdadjoke.com/', {
                headers: {Accept: 'application/json', 'User-Agent': 'fuckicanhazdadjoke'}
            }),
            'data.joke'
        );
        return await interaction.reply(joke);
    }
};
