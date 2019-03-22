const louds = require('./louds');

describe('commands/louds', () => {
    describe('should', () => {
        let oldLoud = {},
            message = {},
            model = {};

        beforeEach(() => {
            oldLoud = {
                increment: jest.fn(),
                message: 'MIND',
            };

            message = {
                content: 'FEAR',
                author: { username: 'derek' },
                channel: { send: jest.fn().mockName('send') },
                reply: jest
                    .fn()
                    .mockResolvedValue(true)
                    .mockName('reply'),
            };

            model = {
                Louds: {
                    create: jest.fn().mockName('createLoud'),
                    findOne: jest
                        .fn()
                        .mockResolvedValue(false)
                        .mockName('findOneLoud'),
                    destroy: jest
                        .fn()
                        .mockResolvedValueOnce(1)
                        .mockName('deleteLoud'),
                },
                Louds_Banned: {
                    create: jest.fn().mockName('createBannedLoud'),
                    findOne: jest
                        .fn()
                        .mockResolvedValue(false)
                        .mockName('findOneBannedLoud'),
                    destroy: jest
                        .fn()
                        .mockResolvedValueOnce(1)
                        .mockName('deleteLoud'),
                },
            };
        });

        it('respond to delete', async () => {
            await louds(message, 'delete fake-data', model);
            const reply = message.reply;
            expect(reply).toHaveBeenCalledTimes(1);
        });

        it('respond to ban', async () => {
            await louds(message, 'ban fake-data', model);
            const reply = message.reply;
            expect(reply).toHaveBeenCalledTimes(1);
        });

        it('respond to unban', async () => {
            await louds(message, 'unban fake-data', model);
            const reply = message.reply;
            expect(reply).toHaveBeenCalledTimes(1);
        });

        it('not respond with nuke command', async () => {
            await louds(message, 'nuke fake-data', model);
            const reply = message.reply;
            expect(reply).not.toHaveBeenCalled();
        });

        it('not respond with all command', async () => {
            await louds(message, 'all fake-data', model);
            const reply = message.reply;
            expect(reply).not.toHaveBeenCalled();
        });

        it('not respond without command', async () => {
            await louds(message, 'hotgarbage fake-data', model);
            const reply = message.reply;
            expect(reply).not.toHaveBeenCalled();
        });

        it('respond to failed delete', async () => {
            model.Louds.destroy = jest
                .fn()
                .mockResolvedValueOnce(0)
                .mockName('deleteDestroyLouds');
            await louds(message, 'delete fake-data', model);
            const reply = message.reply();
            expect(reply).toBeTruthy();
        });

        it('ban loud with ban command', async () => {
            model.Louds_Banned.findOne = jest
                .fn()
                .mockResolvedValue(false)
                .mockName('banFindOneBannedLoud');
            await louds(message, 'ban fake-data', model);
            const create = model.Louds_Banned.create.mock.calls;
            expect(create).toHaveLength(1);
        });

        it('cannot ban if already banned with ban command', async () => {
            model.Louds_Banned.findOne = jest
                .fn()
                .mockResolvedValue(true)
                .mockName('banFindOneBannedLoud');
            louds(message, 'ban fake-data', model);
            const create = await model.Louds_Banned.create.mock.calls;
            expect(create).toHaveLength(0);
        });

        it('delete loud with ban command', async () => {
            model.Louds.findOne = jest
                .fn()
                .mockResolvedValue(true)
                .mockName('banFindOneLoud');
            await louds(message, 'ban fake-data', model);
            const destroy = model.Louds.destroy.mock.calls;
            expect(destroy).toHaveLength(1);
        });

        it('add loud with unban command', async () => {
            model.Louds.findOne = jest
                .fn()
                .mockResolvedValue(false)
                .mockName('unbanFindOneLoud');
            await louds(message, 'unban fake-data', model);
            const create = model.Louds.create.mock.calls;
            expect(create).toHaveLength(1);
        });

        it('delete banned loud with unban command', async () => {
            model.Louds_Banned.findOne = jest
                .fn()
                .mockResolvedValue(true)
                .mockName('unbanFindOneBannedLoud');
            await louds(message, 'unban fake-data', model);
            const destroy = model.Louds_Banned.destroy.mock.calls;
            expect(destroy).toHaveLength(1);
        });
    });
});
