const unders = require('./adlibs');
const botConfig = require('../config');

describe('commands/unders', () => {
    describe('should', () => {
        let message = {},
            model = {};

        beforeEach(() => {
            message = {
                author: { id: botConfig.serverOwner, username: 'guy' },
                channel: { send: jest.fn().mockName('send') },
                reply: jest.fn().mockResolvedValue(true).mockName('reply')
            };
            model = {
                Adlibs: {
                    create: jest.fn().mockName('createAdlib'),
                    update: jest.fn().mockName('updateAdlib'),
                    destroy: jest.fn().mockName('destroyAdlib'),
                    findOne: jest.fn().mockResolvedValue(false).mockName('findOneAdlib')
                }
            };
        });

        it('respond to add with create if it does not exists', async () => {
            await unders(message, 'add fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Adlib added.');
        });

        it('respond to add with nope if it does exist', async () => {
            model.Adlibs.findOne = jest.fn().mockResolvedValue(true).mockName('findOneAdlibExists');
            await unders(message, 'add fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith(
                'Adlib already exists. You can remove it with `!adlib remove <text>`.'
            );
        });

        it('create value', async () => {
            await unders(message, 'add fake-value', model);
            const created = model.Adlibs.create;
            expect(created).toBeCalledTimes(1);
            expect(created).toBeCalledWith({ value: 'fake-value' });
        });

        it('respond to remove with destroy if exists', async () => {
            model.Adlibs.findOne = jest
                .fn()
                .mockResolvedValue({
                    destroy: model.Adlibs.destroy
                })
                .mockName('findOneAdlibExists');
            await unders(message, 'remove fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Adlib removed.');
        });

        it('destroy value', async () => {
            model.Adlibs.findOne = jest
                .fn()
                .mockResolvedValue({
                    destroy: model.Adlibs.destroy
                })
                .mockName('findOneAdlibExists');
            await unders(message, 'remove fake-value', model);
            const destroyed = model.Adlibs.destroy;
            expect(destroyed).toBeCalledTimes(1);
            expect(destroyed).toBeCalledWith({ force: true });
        });

        it('respond to remove with missing if does not exists', async () => {
            await unders(message, 'remove fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Adlib does not exist.');
        });

        it('respond to missing command', async () => {
            await unders(message, 'hotgarbage fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Adlib subcommand does not exist.');
        });

        it('respond to error', async () => {
            model.Adlibs.findOne.mockRejectedValue(new Error('error'));
            await unders(message, 'something', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Adlib command had an error.');
        });
    });
});
