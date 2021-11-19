const louds = require('./louds');

describe('response/louds', () => {
    describe('should', () => {
        let message, model, mockChannelSend;
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
            model = {
                Louds: {
                    create: jest.fn().mockName('createLouds'),
                    findOne: jest
                        .fn()
                        .mockResolvedValueOnce(oldLoud)
                        .mockResolvedValueOnce(false)
                        .mockName('findOneLouds')
                },
                Louds_Banned: {
                    findOne: jest.fn().mockResolvedValue(false).mockName('Louds_Banned')
                }
            };
        });

        it('respond to loud one time', async () => {
            await louds(message, model);
            const sent = message.channel.send.mock.calls;
            expect(sent).toHaveLength(1);
        });

        it('not respond if not a loud', async () => {
            message.content = 'fear';
            await louds(message, model);
            const sent = message.channel.send.mock.calls;
            expect(sent).toHaveLength(0);
        });

        it('respond to no louds in db', async () => {
            model.Louds.findOne = jest
                .fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(false)
                .mockName('emptyLouds');
            await louds(message, model);
            const sent = message.channel.send.mock.calls[0][0];
            expect(sent).toMatch(/No louds stored yet\./);
        });

        it('increment oldLoud usage count', async () => {
            await louds(message, model);
            const incremented = oldLoud.increment.mock.calls;
            expect(incremented).toHaveLength(1);
        });

        it('check for loud already stored', async () => {
            const newLoud = {
                increment: jest.fn(),
                message: 'KILLER'
            };
            model.Louds.findOne = jest
                .fn()
                .mockResolvedValueOnce(false)
                .mockResolvedValueOnce(newLoud)
                .mockName('existsLouds');
            await louds(message, model);
            const findOne = await model.Louds.findOne.mock.results[1].value;
            expect(findOne).toBeTruthy();
        });

        it('check for banned loud', async () => {
            const bannedLoud = {
                message: 'KILLER',
                username: 'MAUDIB'
            };
            model.Louds_Banned.findOne = jest
                .fn()
                .mockResolvedValue(bannedLoud)
                .mockName('existsLouds_Banned');
            await louds(message, model);
            const findOne = await model.Louds_Banned.findOne.mock.results[0].value;
            expect(findOne).toBeTruthy();
        });

        it('store newLoud', async () => {
            await louds(message, model);
            const create = model.Louds.create;
            const stored = { message: message.content, username: message.author.id };
            expect(create).toHaveBeenCalledWith(stored);
        });
    });
});
