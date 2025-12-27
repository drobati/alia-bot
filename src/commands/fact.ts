import axios from "axios";
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Context } from "../types";

const factCommand = {
    data: new SlashCommandBuilder()
        .setName('fact')
        .setDescription('Get a random fun fact.'),
    async execute(interaction: ChatInputCommandInteraction, { log }: Context) {
        try {
            await interaction.deferReply();

            const response = await axios.get('https://uselessfacts.jsph.pl/api/v2/facts/random', {
                headers: { 'User-Agent': 'Alia Discord Bot' },
            });

            const factData = response.data;
            if (!factData || !factData.text) {
                return await interaction.editReply('Could not fetch a fact at this time.');
            }

            const embed = new EmbedBuilder()
                .setColor(0x57F287)
                .setTitle('🧠 Random Fact')
                .setDescription(factData.text)
                .setFooter({ text: factData.source ? `Source: ${factData.source}` : 'Useless Facts API' });

            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            log.error({ error }, 'Error fetching fact');

            if (interaction.deferred) {
                return await interaction.editReply('Sorry, I could not fetch a fact at this time.');
            }
            return await interaction.reply('Sorry, I could not fetch a fact at this time.');
        }
    },
};

export default factCommand;
