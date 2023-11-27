import { SlashCommandBuilder } from "discord.js";
import qrcode from "qrcode";
import * as yup from "yup";

export default {
    data: new SlashCommandBuilder()
        .setName('qr')
        .setDescription('Generate a QR code for the provided URL.')
        .addStringOption((option: any) => option.setName('url')
            .setDescription('The URL to generate a QR code for')
            .setRequired(true)),
    async execute(interaction: any, context: any) {
        let url = interaction.options.getString('url');

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
            // @ts-expect-error TS(2554): Expected 2 arguments, but got 1.
            const buffer = await generateQR(url);
            await interaction.reply({
                files: [{
                    attachment: buffer,
                    name: 'qrcode.png',
                }],
            });
        } catch (qrError) {
            // Handle QR code generation errors
            context.log.error('Failed to generate QR code:', qrError);
            await interaction.reply({ content: 'Failed to generate QR code. Please try again.', ephemeral: true });
        }
    },
};

const generateQR = async (text: any,  context: any) => {
    try {
        const data = await qrcode.toDataURL(text);
        return Buffer.from(data.split(',')[1], 'base64');
    } catch (error) {
        context.log.error('Failed to generate QR code:', error);
        throw error; // Rethrowing the original error
    }
};
