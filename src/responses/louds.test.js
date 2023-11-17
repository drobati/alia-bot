const louds = require('./louds');
const { createTable, createContext } = require("../utils/testHelpers");

describe('response/louds', () => {
    let context, message, Louds, Louds_Banned, mockChannelSend;
    let oldLoud;

    beforeEach(() => {
        context = createContext();
        mockChannelSend = jest.fn();
        oldLoud = {
            increment: jest.fn(),
            message: 'OLD LOUD',
        };
        message = {
            content: 'LOUD MESSAGE',
            author: { id: '1234', username: 'derek' },
            channel: { send: mockChannelSend },
        };
        Louds = createTable();
        Louds.findOne.mockResolvedValue(null);
        Louds_Banned = createTable();
        Louds_Banned.findOne.mockResolvedValue(null);
        context.tables = { Louds, Louds_Banned };
    });

    it('responds to loud one time', async () => {
        Louds.findOne.mockResolvedValueOnce(oldLoud);
        await louds(message, context);
        expect(mockChannelSend).toHaveBeenCalledWith(oldLoud.message);
        expect(oldLoud.increment).toHaveBeenCalled();
    });

    it('does not respond if not a loud', async () => {
        message.content = 'not a loud';
        await louds(message, context);
        expect(mockChannelSend).not.toHaveBeenCalled();
        expect(Louds.create).not.toHaveBeenCalled();
    });

    it('responds to no louds in db', async () => {
        await louds(message, context);
        expect(mockChannelSend).toHaveBeenCalledWith('No louds stored yet.');
    });

    it('increments oldLoud usage count', async () => {
        Louds.findOne.mockResolvedValueOnce(oldLoud);
        await louds(message, context);
        expect(oldLoud.increment).toHaveBeenCalled();
    });

    it('does not create loud already stored', async () => {
        Louds.findOne.mockResolvedValueOnce(oldLoud)
            .mockResolvedValueOnce({ ...oldLoud, message: 'LOUD EXISTS' })
        context.tables.Louds = Louds;
        await louds(message, context);
        expect(Louds.create).not.toHaveBeenCalled();
    });

    it('does not store banned loud', async () => {
        const bannedLoud = { message: 'LOUD MESSAGE' };
        Louds_Banned.findOne.mockResolvedValue(bannedLoud);
        await louds(message, context);
        expect(Louds.create).not.toHaveBeenCalled();
    });

    it('stores newLoud', async () => {
        await louds(message, context);
        const stored = { message: message.content, username: message.author.id };
        expect(Louds.create).toHaveBeenCalledWith(stored);
    });
});
