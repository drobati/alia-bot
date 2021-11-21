const qrcode = require('./qrcode');
const QRCode = require('qrcode');
jest.mock('qrcode');

describe('commands/qrcode', () => {
    let message;

    beforeEach(() => {
        message = {
            content: '',
            channel: {
                send: jest.fn()
            }
        };
        QRCode.toDataURL = jest.fn().mockResolvedValue('works');
    });

    describe('should', () => {
        it('respond with code', async () => {
            message.content = '!qr https://google.com';
            await qrcode(message);
            expect(message.channel.send).toHaveBeenCalledWith('works');
        });

        it('respond if invalid url', async () => {
            message.content = '!qr google.com';
            await qrcode(message);
            expect(message.channel.send).toHaveBeenCalledWith('Please provide a valid URL.');
        });
    });
});
