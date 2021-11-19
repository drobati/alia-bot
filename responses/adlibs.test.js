const adlibs = require('./adlibs');

describe('response/adlibs', () => {
    describe('should', () => {
        let message, model;

        beforeEach(() => {
            message = {
                content: 'The --- walks in.',
                author: { id: '1234', username: 'guy' },
                channel: { send: jest.fn().mockName('send') }
            };
            model = {
                Adlibs: {
                    findOne: jest.fn().mockResolvedValue({ value: 'cat' }).mockName('findOneAdlibs')
                }
            };
        });

        it('respond to adlib one time', async () => {
            await adlibs(message, model);
            const sent = message.channel.send;
            expect(sent).toBeCalledTimes(1);
            expect(sent).toBeCalledWith('The cat walks in.');
            console.log(sent);
        });

        it('respond should match format', async () => {
            await adlibs(message, model);
            const sent = message.channel.send.mock.calls;
            expect(sent).toHaveLength(1);
        });

        it('respond should match multiple words', async () => {
            message.content = 'The ---, ---, and --- ran by.';
            model.Adlibs.findOne = jest
                .fn()
                .mockResolvedValueOnce({ value: 'dog' })
                .mockResolvedValueOnce({ value: 'cat' })
                .mockResolvedValueOnce({ value: 'mouse' })
                .mockName('findOneMultipleAdlibs');
            await adlibs(message, model);
            const sent = message.channel.send;
            expect(sent).toBeCalledTimes(1);
            expect(sent).toBeCalledWith('The dog, cat, and mouse ran by.');
        });

        it('not respond if not an adlib', async () => {
            message.content = 'fear';
            await adlibs(message, model);
            const sent = message.channel.send.mock.calls;
            expect(sent).toHaveLength(0);
        });

        it('respond to no adlibs in db', async () => {
            model.Adlibs.findOne = jest.fn().mockResolvedValue(false).mockName('emptyAdlibs');
            await adlibs(message, model);
            const sent = message.channel.send.mock.calls[0][0];
            expect(sent).toMatch(/No adlibs stored yet\./);
        });
    });
});
