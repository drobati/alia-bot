import adlibs from "./adlibs";
import { createContext, createTable } from "../utils/testHelpers";

describe('response/adlibs', () => {
    let context: any, message: any, Adlibs: any;

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
        const result = await adlibs(message, context);
        expect(message.channel.send).toBeCalledWith('The **cat** walks in.');
        expect(result).toBe(true);
    });

    it('responds should match multiple words', async () => {
        message.content = 'The ---, ---, and --- ran by.';
        Adlibs.findOne = jest
            .fn()
            .mockResolvedValueOnce({ value: 'dog' })
            .mockResolvedValueOnce({ value: 'cat' })
            .mockResolvedValueOnce({ value: 'mouse' });
        const result = await adlibs(message, context);
        expect(message.channel.send).toBeCalledWith(
            'The **dog**, **cat**, and **mouse** ran by.',
        );
        expect(result).toBe(true);
    });

    it('does not respond if not an adlib', async () => {
        message.content = 'regular text';
        const result = await adlibs(message, context);
        expect(message.channel.send).not.toHaveBeenCalled();
        expect(result).toBe(false);
    });

    it('returns false when no adlibs in db', async () => {
        Adlibs.findOne.mockResolvedValue(null);
        const result = await adlibs(message, context);
        expect(result).toBe(false);
        expect(message.channel.send).not.toHaveBeenCalled();
    });
});
