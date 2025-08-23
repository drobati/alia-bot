import { SlashCommandBuilder, ChatInputCommandInteraction, SlashCommandStringOption } from "discord.js";
import qrcode from "qrcode";
import * as yup from "yup";
import { Context } from "../types";

const qrcodeCommand = {
    data: new SlashCommandBuilder()
        .setName('qr')
        .setDescription('Generate a QR code for the provided URL.')
        .addStringOption((option: SlashCommandStringOption) => option.setName('url')
            .setDescription('The URL to generate a QR code for')
            .setRequired(true)),
    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        let url = interaction.options.getString('url');

        if (!url) {
            await interaction.reply({ content: 'Please provide a URL.', ephemeral: true });
            return;
        }

        // Add protocol if it's missing
        if (!/^(?:f|ht)tps?:\/\//.test(url)) {
            url = 'https://' + url;
        }

        const schema = yup.string().url();

        try {
            await schema.validate(url);
        } catch (validationError) {
            // Handle URL validation errors
            await interaction.reply({ content: 'Please provide a valid URL.', ephemeral: true });
            return;
        }

        try {
            const buffer = await generateQR(url, context);
            await interaction.reply({
                files: [{
                    attachment: buffer,
                    name: 'qrcode.png',
                }],
            });
        } catch (qrError) {
            // Handle QR code generation errors
            context.log.error({ error: qrError }, 'Failed to generate QR code');
            await interaction.reply({ content: 'Failed to generate QR code. Please try again.', ephemeral: true });
        }
    },
};

const generateQR = async (text: string, context: Context): Promise<Buffer> => {
    try {
        const data = await qrcode.toDataURL(text);
        return Buffer.from(data.split(',')[1], 'base64');
    } catch (error) {
        context.log.error({ error }, 'Failed to generate QR code');
        throw error; // Rethrowing the original error
    }
};

export default qrcodeCommand;
