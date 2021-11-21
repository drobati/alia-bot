const louds = require('./louds');

describe('response/louds', () => {
    describe('should', () => {
        let message, Louds, Louds_Banned, mockChannelSend;
        let oldLoud;

        beforeEach(() => {
            mockChannelSend = jest.fn();
            oldLoud = {
                increment: jest.fn(),
                message: 'MIND'
            };
            message = {
                content: 'FEAR',
                author: { id: '1234', username: 'derek' },
                channel: { send: mockChannelSend }
            };
            Louds = {
                create: jest.fn(),
                findOne: jest.fn().mockResolvedValueOnce(oldLoud).mockResolvedValueOnce(false)
            };
            Louds_Banned = {
                findOne: jest.fn().mockResolvedValue(false)
            };
        });

        it('respond to loud one time', async () => {
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send.mock.calls).toHaveLength(1);
        });

        it('not respond if not a loud', async () => {
            message.content = 'fear';
            await louds(message, Louds, Louds_Banned);
            expect(message.channel.send.mock.calls).toHaveLength(0);
        });

        it('respond to no louds in db', async () => {
            Louds.findOne = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(false);
            await louds(message, Louds, Louds_Banned);
            const sent = message.channel.send.mock.calls[0][0];
            expect(sent).toMatch(/No louds stored yet\./);
        });

        it('increment oldLoud usage count', async () => {
            await louds(message, Louds, Louds_Banned);
            const incremented = oldLoud.increment.mock.calls;
            expect(incremented).toHaveLength(1);
        });

        it('check for loud already stored', async () => {
            const newLoud = {
                increment: jest.fn(),
                message: 'KILLER'
            };
            Louds.findOne = jest.fn().mockResolvedValueOnce(false).mockResolvedValueOnce(newLoud);
            await louds(message, Louds, Louds_Banned);
            const findOne = await Louds.findOne.mock.results[1].value;
            expect(findOne).toBeTruthy();
        });

        it('check for banned loud', async () => {
            const bannedLoud = {
                message: 'KILLER',
                username: 'MAUDIB'
            };
            Louds_Banned.findOne = jest.fn().mockResolvedValue(bannedLoud);
            await louds(message, Louds, Louds_Banned);
            const findOne = await Louds_Banned.findOne.mock.results[0].value;
            expect(findOne).toBeTruthy();
        });

        it('store newLoud', async () => {
            await louds(message, Louds, Louds_Banned);
            const create = Louds.create;
            const stored = { message: message.content, username: message.author.id };
            expect(create).toHaveBeenCalledWith(stored);
        });
    });
});
