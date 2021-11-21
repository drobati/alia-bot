const { stripIndent } = require('common-tags');
const memories = require('./memories');

describe('commands/config', () => {
    let message = {},
        Memories = {};

    beforeEach(() => {
        message = {
            channel: { send: jest.fn() }
        };
        Memories = {
            upsert: jest.fn(),
            findAll: jest.fn().mockResolvedValue(false),
            findOne: jest.fn().mockResolvedValue(false)
        };
    });

    describe('should respond to', () => {
        // . !remember get <key> - Returns a string
        it('get <key>', async () => {
            message.content = '!remember get fake-key';
            Memories.findOne = jest.fn().mockResolvedValue({ value: 'fake-value' });
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith('"fake-key" is "fake-value".');
        });

        // . !remember add <key> <value>. - Returns confirmation.
        it('add <key> <value> if new', async () => {
            message.content = '!remember add fake-key fake-value';
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith('"fake-key" is now "fake-value".');
        });

        // . !remember delete <key> - Removes key from hubots brain.
        it('delete <key>', async () => {
            message.content = '!remember delete fake-key';
            Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value', destroy: jest.fn() });
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith('"fake-key" was "fake-value".');
        });

        // . !remember top <amount> - Returns top 5 hubot remembers.
        it('top <amount>', async () => {
            message.content = '!remember top 5';
            Memories.findAll = jest.fn().mockResolvedValue([
                { key: 'fake-key-1', value: 'fake-value-1' },
                { key: 'fake-key-2', value: 'fake-value-2' },
                { key: 'fake-key-3', value: 'fake-value-3' },
                { key: 'fake-key-4', value: 'fake-value-4' },
                { key: 'fake-key-5', value: 'fake-value-5' }
            ]);
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith(stripIndent`
            Top 5 Memories:
             * "fake-key-1" is "fake-value-1"
             * "fake-key-2" is "fake-value-2"
             * "fake-key-3" is "fake-value-3"
             * "fake-key-4" is "fake-value-4"
             * "fake-key-5" is "fake-value-5"
            `);
        });

        // . !remember random <amount> - Returns a random string
        it('random <amount>', async () => {
            message.content = '!remember random 5';
            Memories.findAll = jest.fn().mockResolvedValue([
                { key: 'fake-key-1', value: 'fake-value-1' },
                { key: 'fake-key-2', value: 'fake-value-2' },
                { key: 'fake-key-3', value: 'fake-value-3' },
                { key: 'fake-key-4', value: 'fake-value-4' },
                { key: 'fake-key-5', value: 'fake-value-5' }
            ]);
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith(stripIndent`
            Random 5 Memories:
             * "fake-key-1" is "fake-value-1"
             * "fake-key-2" is "fake-value-2"
             * "fake-key-3" is "fake-value-3"
             * "fake-key-4" is "fake-value-4"
             * "fake-key-5" is "fake-value-5"
            `);
        });

        // . !remember blah
        it('if nothing matches', async () => {
            message.content = '!remember blah blah blah';
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith("I don't understand that command.");
        });

        // . !remember trigger <key> - Flags a key
        it('trigger <key>', async () => {
            message.content = '!remember trigger fake-key';
            Memories.findOne = jest.fn().mockResolvedValue({ update: jest.fn() });
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith('"fake-key" is now triggered.');
        });

        // . !remember untrigger <key> - Removes trigger flag
        it('untrigger <key>', async () => {
            message.content = '!remember untrigger fake-key';
            Memories.findOne = jest.fn().mockResolvedValue({ update: jest.fn() });
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith('"fake-key" is now untriggered.');
        });
    });

    describe('should respond to edge case if', () => {
        // . !remember get <key> - Returns a string
        it("get <key> doesn't exist", async () => {
            message.content = '!remember get fake-key';
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith("I can't remember, fake-key.");
        });

        // . !remember add <key> <value>. - Returns confirmation.
        it('add <key> <value> already exists', async () => {
            message.content = '!remember add fake-key fake-value-2';
            Memories.findOne = jest
                .fn()
                .mockResolvedValue({ value: 'fake-value-1', update: jest.fn() });
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledTimes(1);
            expect(message.channel.send).toBeCalledWith(
                '"fake-key" is now \n"fake-value-2" \nand was \n"fake-value-1"'
            );
        });

        // . !remember delete <key> - Removes key from hubots brain.
        it('delete <key> has no <key> to remove', async () => {
            message.content = '!remember delete fake-key';
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith("I can't remember, fake-key.");
        });

        // . !remember top <amount> - Returns top 5 hubot remembers.
        it('top <amount> has no memories', async () => {
            message.content = '!remember top 5';
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith("I can't remember anything.");
        });

        // . !remember random <amount> - Returns a random string
        it('random <amount> has no memories', async () => {
            message.content = '!remember random 5';
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith("I can't remember anything.");
        });

        it("top <amount> can't be more than 10", async () => {
            message.content = '!remember top 11';
            Memories.findAll = jest
                .fn()
                .mockResolvedValue([{ key: 'fake-key-1', value: 'fake-value-1' }]);
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith(stripIndent`
            Top 10 Memories:
             * "fake-key-1" is "fake-value-1"
            `);
        });

        it("random <amount> can't be more than 10", async () => {
            message.content = '!remember random 11';
            Memories.findAll = jest
                .fn()
                .mockResolvedValue([{ key: 'fake-key-1', value: 'fake-value-1' }]);
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith(stripIndent`
            Random 10 Memories:
             * "fake-key-1" is "fake-value-1"
            `);
        });

        it('trigger <key> has no <key> to trigger', async () => {
            message.content = '!remember trigger fake-key';
            await memories(message, Memories);
            expect(message.channel.send).toBeCalledWith("I can't remember, fake-key.");
        });
    });
});
