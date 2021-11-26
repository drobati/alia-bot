//!qr <url>
const qrcode = require('qrcode');
const yup = require('yup');

const generateQR = async (text) => {
    const data = await qrcode.toDataURL(text);
    return new Buffer.from(data.split(',')[1], 'base64');
};

module.exports = async (message) => {
    await message.suppressEmbeds(true);
    const words = message.content.split(' ').splice(1);
    const url = words.shift();

    const schema = yup.string().url();
    const isValid = await schema.isValid(url);

    if (!isValid) {
        return message.channel.send('Please provide a valid URL.');
    }

    const buffer = await generateQR(url);
    const newMessage = await message.channel.send({
        content: url,
        files: [
            {
                attachment: buffer
            }
        ]
    });
    await newMessage.suppressEmbeds(true);
};
