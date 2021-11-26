const qr = require('./qrcode');
const qrcode = require('qrcode');
jest.mock('qrcode');

describe('commands/qrcode', () => {
    let message;

    beforeEach(() => {
        message = {
            suppressEmbeds: jest.fn(),
            content: '',
            channel: {
                send: jest.fn().mockResolvedValue({
                    suppressEmbeds: jest.fn()
                })
            }
        };
        qrcode.toDataURL = jest.fn().mockResolvedValue('a,test');
    });

    describe('should', () => {
        it('respond with code', async () => {
            const buf = new Buffer.from('test', 'base64');
            message.content = '!qr https://google.com';
            await qr(message);
            expect(message.channel.send).toHaveBeenCalledWith({
                content: 'https://google.com',
                files: [
                    {
                        attachment: buf
                    }
                ]
            });
        });

        it('respond if invalid url', async () => {
            message.content = '!qr google.com';
            await qr(message);
            expect(message.channel.send).toHaveBeenCalledWith('Please provide a valid URL.');
        });
    });
});
