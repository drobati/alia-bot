// QR slash command
const qrcode = require('qrcode');
const yup = require('yup');

const generateQR = async (text) => {
    const data = await qrcode.toDataURL(text);
    return new Buffer.from(data.split(',')[1], 'base64');
};

/**
 * This function gets the link from the slash command and sends a message back
 * with a QR code.
 *
 * @param {object} interaction
 *
 */

module.exports = async (interaction) => {
    const url = interaction.options.getString('link');

    const schema = yup.string().url();
    const isValid = await schema.isValid(url);

    if (!isValid) {
        return interaction.reply('Please provide a valid URL.');
    }

    const buffer = await generateQR(url);
    await interaction.reply({
        content: `<${url}>`,
        files: [
            {
                attachment: buffer
            }
        ]
    });
};
