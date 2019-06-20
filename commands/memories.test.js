const { stripIndent } = require('common-tags');
const memories = require('./memories');
const botConfig = require('../config');

describe('commands/config', () => {
    let message = {},
        model = {};

    beforeEach(() => {
        message = {
            author: { id: botConfig.serverOwner, username: 'derek' },
            channel: { send: jest.fn().mockName('channel.send') },
            reply: jest
                .fn()
                .mockResolvedValue(true)
                .mockName('reply'),
        };
        model = {
            Memories: {
                create: jest.fn().mockName('Memories.create'),
                update: jest.fn().mockName('Memories.update'),
                destroy: jest.fn().mockName('Memories.destroy'),
                findAll: jest
                    .fn()
                    .mockResolvedValue(false)
                    .mockName('Memories.findAll'),
                findOne: jest
                    .fn()
                    .mockResolvedValue(false)
                    .mockName('Memories.findOne'),
            },
        };
    });

    describe('should respond to', () => {
        // . ? is|remember <key> - Returns a string
        it('is <key>', async () => {
            message.content = '? is fake-key';
            model.Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value' })
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('"fake-key" is "fake-value".');
        });

        it('what is <key>', async () => {
            message.content = '? what is fake-key';
            model.Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value' })
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('"fake-key" is "fake-value".');
        });

        it('remember <key>', async () => {
            message.content = '? remember fake-key';
            model.Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value' })
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('"fake-key" is "fake-value".');
        });

        it('rem <key>', async () => {
            message.content = '? rem fake-key';
            model.Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value' })
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('"fake-key" is "fake-value".');
        });

        // . ? <key> is <value>. - Returns confirmation.
        it('<key> is <value> if new', async () => {
            message.content = '? fake-key is fake-value';
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('"fake-key" is now "fake-value".');
        });
        // . ? forget <key> - Removes key from hubots brain.
        it('forget <key>', async () => {
            message.content = '? forget fake-key';
            model.Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value', destroy: model.Memories.destroy })
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('"fake-key" was "fake-value".');
        });

        // . ? favorite memories - Returns top 5 hubot remembers.
        it('favorite memories', async () => {
            message.content = '? favorite memories';
            model.Memories.findAll = jest
                .fn()
                .mockResolvedValue([
                    { key: 'fake-key-1', value: 'fake-value-1' },
                    { key: 'fake-key-2', value: 'fake-value-2' },
                    { key: 'fake-key-3', value: 'fake-value-3' },
                    { key: 'fake-key-4', value: 'fake-value-4' },
                    { key: 'fake-key-5', value: 'fake-value-5' },
                ])
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith(stripIndent`
            Top Five Memories:
             * "fake-key-1" is "fake-value-1"
             * "fake-key-2" is "fake-value-2"
             * "fake-key-3" is "fake-value-3"
             * "fake-key-4" is "fake-value-4"
             * "fake-key-5" is "fake-value-5"
            `);
        });

        // . ? random memory - Returns a random string
        it('random memory', async () => {
            message.content = '? random memory';
            model.Memories.findOne = jest
                .fn()
                .mockResolvedValue({ key: 'fake-key-random', value: 'fake-value-random' })
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('Random "fake-key-random" is "fake-value-random".');
        });
    });

    describe('should not respond', () => {
        // . ? blah
        it('if nothing matches', async () => {
            message.content = '? blah blah blah';
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(0);
        });
    });

    describe('should respond to edge case if', () => {
        // . ? (what )is|rem(ember) <key> - Returns a string
        it('what is <key> does not exist', async () => {
            message.content = '? what is fake-key';
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('I have no memory of "fake-key".');
        });

        // . ? <key> is <value>. - Returns confirmation.
        it('<key> is <value> already exists', async () => {
            message.content = '? fake-key is fake-value-2';
            model.Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value-1', update: model.Memories.update })
                .mockName('Memories.findOne.true');
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith(
                '"fake-key" is now \n"fake-value-2" \nand was \n"fake-value-1"'
            );
        });

        // . ? forget <key> - Removes key from hubots brain.
        it('forget <key> has no <key> to remove', async () => {
            message.content = '? forget fake-key';
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('I have no memory of "fake-key".');
        });

        // . ? favorite memories - Returns top 5 hubot remembers.
        it('favorite memories has no memories', async () => {
            message.content = '? favorite memories';
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('I have no memories to give.');
        });
        // . ? random memory - Returns a random string
        it('random memory has no memories', async () => {
            message.content = '? random memory';
            await memories(message, model);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('I have no memories to give.');
        });
    });
});
