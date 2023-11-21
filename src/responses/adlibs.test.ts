const adlibs = require('./adlibs');
const { createTable, createContext } = require("../utils/testHelpers");

describe('response/adlibs', () => {
    let context, message, Adlibs;

    beforeEach(() => {
        context = createContext();
        message = {
            content: 'The --- walks in.',
            channel: { send: jest.fn() },
        };
        Adlibs = createTable();
        context.tables = { Adlibs };
    });

    it('responds to adlib one time', async () => {
        Adlibs.findOne.mockResolvedValue({ value: 'cat' });
        await adlibs(message, context);
        expect(message.channel.send).toBeCalledWith('The **cat** walks in.');
    });

    it('responds should match multiple words', async () => {
        message.content = 'The ---, ---, and --- ran by.';
        Adlibs.findOne = jest
            .fn()
            .mockResolvedValueOnce({ value: 'dog' })
            .mockResolvedValueOnce({ value: 'cat' })
            .mockResolvedValueOnce({ value: 'mouse' });
        await adlibs(message, context);
        expect(message.channel.send).toBeCalledWith(
            'The **dog**, **cat**, and **mouse** ran by.',
        );
    });

    it('does not respond if not an adlib', async () => {
        message.content = 'regular text';
        await adlibs(message, context);
        expect(message.channel.send).not.toHaveBeenCalled();
    });

    it('responds to no adlibs in db', async () => {
        Adlibs.findOne.mockResolvedValue(null);
        await expect(adlibs(message, context)).rejects.toThrowError('No adlibs found in table.');
    });
});
