import { createContext, createTable } from "../utils/testHelpers";
import triggers from "./triggers";

describe('responses/triggers', () => {
    let context: any, message: any, Memories: any;

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
