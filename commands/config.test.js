const config = require('./config');
const botConfig = require('../config');

describe('commands/config', () => {
    describe('should', () => {
        let message = {},
            model = {};

        beforeEach(() => {
            message = {
                author: { id: botConfig.serverOwner, username: 'derek' },
                channel: { send: jest.fn().mockName('send') },
                reply: jest.fn().mockResolvedValue(true).mockName('reply')
            };
            model = {
                Config: {
                    create: jest.fn().mockName('createConfig'),
                    update: jest.fn().mockName('updateConfig'),
                    destroy: jest.fn().mockName('destroyConfig'),
                    findOne: jest.fn().mockResolvedValue(false).mockName('findOneConfig')
                }
            };
        });

        it('respond to add with create if does not exists', async () => {
            await config(message, 'add fake-key fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Config added.');
        });

        it('create key and value', async () => {
            await config(message, 'add fake-key fake-value', model);
            const created = model.Config.create;
            expect(created).toBeCalledTimes(1);
            expect(created).toBeCalledWith({ key: 'fake-key', value: 'fake-value' });
        });

        it('respond to add with update if exists', async () => {
            model.Config.findOne = jest
                .fn()
                .mockResolvedValue({
                    update: model.Config.update
                })
                .mockName('findOneConfigExists');
            await config(message, 'add fake-key fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Config updated.');
        });

        it('updated key and value', async () => {
            model.Config.findOne = jest
                .fn()
                .mockResolvedValue({
                    update: model.Config.update
                })
                .mockName('findOneConfigExists');
            await config(message, 'add fake-key fake-value', model);
            const updated = model.Config.update;
            expect(updated).toBeCalledTimes(1);
            expect(updated).toBeCalledWith({ key: 'fake-key', value: 'fake-value' });
        });

        it('respond to remove with removed if exists', async () => {
            model.Config.findOne = jest
                .fn()
                .mockResolvedValue({
                    destroy: model.Config.destroy
                })
                .mockName('findOneConfigExists');
            await config(message, 'remove fake-key fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Config removed.');
        });

        it('destroy key and value', async () => {
            model.Config.findOne = jest
                .fn()
                .mockResolvedValue({
                    destroy: model.Config.destroy
                })
                .mockName('findOneConfigExists');
            await config(message, 'remove fake-key fake-value', model);
            const destroyed = model.Config.destroy;
            expect(destroyed).toBeCalledTimes(1);
            expect(destroyed).toBeCalledWith({ force: true });
        });

        it('respond to remove with missing if does not exists', async () => {
            await config(message, 'remove fake-key fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Config does not exist.');
        });

        it('respond to missing command', async () => {
            await config(message, 'hotgarbage fake-key fake-value', model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Config subcommand does not exist.');
        });
    });
});
