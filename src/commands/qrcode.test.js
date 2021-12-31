const qr = require('./qrcode');
const qrcode = require('qrcode');
jest.mock('qrcode');

describe('commands/qrcode', () => {
    let interaction, url;
    beforeEach(() => {
        url = 'https://google.com';
        interaction = {
            options: {
                getString: jest.fn().mockReturnValue(url)
            },
            reply: jest.fn()
        };
        qrcode.toDataURL = jest.fn().mockResolvedValue('a,test');
    });

    describe('should', () => {
        it('respond with code', async () => {
            const buf = new Buffer.from('test', 'base64');
            await qr(interaction);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: '<https://google.com>',
                files: [
                    {
                        attachment: buf
                    }
                ]
            });
        });

        it('respond if invalid url', async () => {
            url = 'google.com';
            interaction.options.getString = jest.fn().mockReturnValue(url);
            await qr(interaction);
            expect(interaction.reply).toHaveBeenCalledWith('Please provide a valid URL.');
        });
    });
});
