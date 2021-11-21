const qrcode = require('./qrcode');
const Discord = require('discord.js');
jest.mock('discord.js');

describe('commands/qrcode', () => {
    let message;

    beforeEach(() => {
        message = {
            content: '',
            channel: {
                send: jest.fn()
            }
        };
        Discord.MessageAttachment = jest.fn().mockImplementation(() => {});
    });

    describe('should', () => {
        it('respond with code', async () => {
            message.content = '!qr https://google.com';
            await qrcode(message);
            expect(message.channel.send).toHaveBeenCalledWith({});
        });

        it('respond if invalid url', async () => {
            message.content = '!qr google.com';
            await qrcode(message);
            expect(message.channel.send).toHaveBeenCalledWith('Please provide a valid URL.');
        });
    });
});
