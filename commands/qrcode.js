//!qr <url>
const QRCode = require('qrcode');
const yup = require('yup');

const generateQR = async (text) => await QRCode.toDataURL(text);

module.exports = async (message) => {
    const words = message.content.split(' ').splice(1);
    const url = words.shift();

    const schema = yup.string().url();
    const isValid = await schema.isValid(url);

    if (!isValid) {
        return message.channel.send('Please provide a valid URL.');
    }

    const qr = await generateQR(url);
    await message.channel.send(qr);
};
