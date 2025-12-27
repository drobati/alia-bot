import axios from "axios";
import { SlashCommandBuilder, ChatInputCommandInteraction, EmbedBuilder } from "discord.js";
import { Context } from "../types";

const quoteCommand = {
    data: new SlashCommandBuilder()
        .setName('quote')
        .setDescription('Get a random inspirational quote.'),
    async execute(interaction: ChatInputCommandInteraction, { log }: Context) {
        try {
            await interaction.deferReply();

            const response = await axios.get('https://zenquotes.io/api/random', {
                headers: { 'User-Agent': 'Alia Discord Bot' },
            });

            const quoteData = response.data?.[0];
            if (!quoteData || !quoteData.q || !quoteData.a) {
                return await interaction.editReply('Could not fetch a quote at this time.');
            }

            const embed = new EmbedBuilder()
                .setColor(0x5865F2)
                .setDescription(`*"${quoteData.q}"*`)
                .setFooter({ text: `— ${quoteData.a}` });

            return await interaction.editReply({ embeds: [embed] });
        } catch (error) {
            log.error({ error }, 'Error fetching quote');

            if (interaction.deferred) {
                return await interaction.editReply('Sorry, I could not fetch a quote at this time.');
            }
            return await interaction.reply('Sorry, I could not fetch a quote at this time.');
        }
    },
};

export default quoteCommand;
