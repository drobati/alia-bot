//!qr <url>
const Discord = require('discord.js');
const QRCode = require('qrcode');
const yup = require('yup');

const generateQR = async (text) => {
    const data = await QRCode.toDataURL(text);
    return new Buffer.from(data.split(',')[1], 'base64');
};

module.exports = async (message) => {
    const words = message.content.split(' ').splice(1);
    const url = words.shift();

    const schema = yup.string().url();
    const isValid = await schema.isValid(url);

    if (!isValid) {
        return message.channel.send('Please provide a valid URL.');
    }

    const buf = await generateQR(url);
    const attachment = new Discord.MessageAttachment(buf, 'output.png');
    await message.channel.send(attachment);
};
