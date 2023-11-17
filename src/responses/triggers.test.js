const triggers = require('./triggers');
const { createTable, createContext } = require("../utils/testHelpers");

describe('responses/triggers', () => {
    let context, message, Memories;

    beforeEach(() => {
        context = createContext();
        message = {
            content: '',
            channel: { send: jest.fn() },
        };
        Memories = createTable();
        context.tables = { Memories };
    });

    it('responds to matches of triggers', async () => {
        message.content = 'this KEY matches';
        Memories.findAll.mockResolvedValue([{ key: 'key', value: 'response' }]);
        await triggers(message, context);
        expect(message.channel.send).toBeCalledWith('response');
    });

    it('does not respond to no match', async () => {
        message.content = "this doesn't match";
        Memories.findAll.mockResolvedValue([{ key: 'key', value: 'response' }]);
        await triggers(message, context);
        expect(message.channel.send).toBeCalledTimes(0);
    });
});
