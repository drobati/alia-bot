const { SlashCommandBuilder } = require('discord.js');
const qrcode = require('qrcode');
const yup = require('yup');

module.exports = {
    data: new SlashCommandBuilder()
        .setName('qr')
        .setDescription('Generate a QR code for the provided URL.')
        .addStringOption(option =>
            option.setName('url')
                .setDescription('The URL to generate a QR code for')
                .setRequired(true)),
    async execute(interaction) {
        let url = interaction.options.getString('url');

        // Add protocol if it's missing
        if (!/^(?:f|ht)tps?:\/\//.test(url)) {
            url = 'http://' + url;
        }

        const schema = yup.string().url();

        try {
            await schema.validate(url);
            const buffer = await generateQR(url);
            await interaction.reply({
                files: [{
                    attachment: buffer,
                    name: 'qrcode.png'
                }]
            });
        } catch (error) {
            await interaction.reply({ content: 'Please provide a valid URL.', ephemeral: true });
        }
    }
};

const generateQR = async (text) => {
    try {
        const data = await qrcode.toDataURL(text);
        return Buffer.from(data.split(',')[1], 'base64');
    } catch (error) {
        console.error('Failed to generate QR code:', error);
        throw new Error('Failed to generate QR code.');
    }
};
