const config = require('./config');
const botConfig = require('../config');

describe('commands/config', () => {
    describe('should', () => {
        let message = {},
            Config = {};

        beforeEach(() => {
            message = {
                author: { id: botConfig.serverOwner, username: 'derek' },
                channel: { send: jest.fn() }
            };
            Config = {
                upsert: jest.fn(),
                findOne: jest.fn().mockResolvedValue(false)
            };
        });

        it('create key and value', async () => {
            message.content = '!config add fake-key fake-value';
            await config(message, Config);
            expect(Config.upsert).toBeCalledWith({ key: 'fake-key', value: 'fake-value' });
            expect(message.channel.send).toBeCalledWith("I've added the config.");
        });

        it('updated key and value', async () => {
            message.content = '!config add fake-key fake-value';
            Config.findOne = jest.fn().mockResolvedValue(true);
            await config(message, Config);
            expect(Config.upsert).toBeCalledWith({ key: 'fake-key', value: 'fake-value' });
            expect(message.channel.send).toBeCalledWith("I've updated the config.");
        });

        it('destroy key and value', async () => {
            message.content = '!config remove fake-key fake-value';
            const destroy = jest.fn().mockResolvedValue(true);
            Config.findOne = jest.fn().mockResolvedValue({ destroy });
            await config(message, Config);
            expect(destroy).toBeCalledWith({ force: true });
            expect(message.channel.send).toBeCalledWith("I've removed the config.");
        });

        it('respond to remove with missing if does not exists', async () => {
            message.content = '!config remove fake-key fake-value';
            await config(message, Config);
            expect(message.channel.send).toBeCalledWith("I don't know that config.");
        });

        it('respond to missing command', async () => {
            message.content = '!config hotgarbage fake-key fake-value';
            await config(message, Config);
            expect(message.channel.send).toBeCalledWith(
                'Invalid subcommand. Use `config add|remove key value?`'
            );
        });

        it('respond to unauthorized user', async () => {
            message.author.id = 'not-derek';
            message.content = '!config add fake-key fake-value';
            await config(message, Config);
            expect(message.channel.send).toBeCalledWith('You may not pass!');
        });

        it('respond to missing key on add', async () => {
            message.content = '!config add';
            await config(message, Config);
            expect(message.channel.send).toBeCalledWith('Missing key. Use `config add key value`');
        });

        it('respond to missing key on remove', async () => {
            message.content = '!config remove';
            await config(message, Config);
            expect(message.channel.send).toBeCalledWith('Missing key. Use `config remove key`');
        });

        it('respond to missing value on add', async () => {
            message.content = '!config add fake-key';
            await config(message, Config);
            expect(message.channel.send).toBeCalledWith(
                'Missing value. Use `config add key value`'
            );
        });
    });
});
