const run = require('./adlibs');

describe('commands/unders', () => {
    describe('should respond with', () => {
        let message = {},
            Adlibs = {};

        beforeEach(() => {
            message = {
                content: '',
                channel: { send: jest.fn().mockResolvedValue(true) }
            };
            Adlibs = {
                create: jest.fn(),
                findOne: jest.fn().mockResolvedValue(false)
            };
        });

        it("I've added that adlib.", async () => {
            message.content = '!adlib add fake-value';
            await run(message, Adlibs);
            expect(message.channel.send).toBeCalledWith("I've added that adlib.");
        });

        it('That adlib already exists.', async () => {
            message.content = '!adlib add fake-value';
            Adlibs.findOne = jest.fn().mockResolvedValue(true);
            await run(message, Adlibs);
            expect(message.channel.send).toBeCalledWith('That adlib already exists.');
        });

        it("I've removed that adlib.", async () => {
            message.content = '!adlib remove fake-value';
            Adlibs.findOne = jest.fn().mockResolvedValue({
                destroy: jest.fn().mockResolvedValue(true)
            });
            await run(message, Adlibs);
            expect(message.channel.send).toBeCalledWith("I've removed that adlib.");
        });

        it("I don't recognize that adlib.", async () => {
            message.content = '!adlib remove fake-value';
            await run(message, Adlibs);
            expect(message.channel.send).toBeCalledWith("I don't recognize that adlib.");
        });

        it("I don't recognize that command.", async () => {
            await run(message, Adlibs);
            expect(message.channel.send).toBeCalledWith("I don't recognize that command.");
        });
    });
});
