const adlibs = require('./adlibs');
const axios = require('axios');

describe('response/adlibs', () => {
    describe('should', () => {
        let message, Adlibs;

        beforeEach(() => {
            message = {
                content: 'The --- walks in.',
                channel: { send: jest.fn() }
            };
            Adlibs = {
                findOne: jest.fn().mockResolvedValue({ value: 'cat' })
            };
        });

        it('respond to adlib one time', async () => {
            await adlibs(message, Adlibs);
            expect(message.channel.send).toBeCalledWith('The **cat** walks in.');
        });

        it('respond should match format', async () => {
            await adlibs(message, Adlibs);
            expect(message.channel.send.mock.calls).toHaveLength(1);
        });

        it('respond should match multiple words', async () => {
            message.content = 'The ---, ---, and --- ran by.';
            Adlibs.findOne = jest
                .fn()
                .mockResolvedValueOnce({ value: 'dog' })
                .mockResolvedValueOnce({ value: 'cat' })
                .mockResolvedValueOnce({ value: 'mouse' });
            await adlibs(message, Adlibs);
            expect(message.channel.send).toBeCalledWith(
                'The **dog**, **cat**, and **mouse** ran by.'
            );
        });

        it('not respond if not an adlib', async () => {
            message.content = 'fear';
            await adlibs(message, Adlibs);
            expect(message.channel.send).toHaveLength(0);
        });

        it('respond to no adlibs in db', async () => {
            Adlibs.findOne = jest.fn().mockResolvedValue(false);
            await expect(adlibs(message, Adlibs)).rejects.toThrowError('No adlibs found in table.');
        });
    });
});
