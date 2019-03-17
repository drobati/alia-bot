const louds = require('./louds');

describe('response/louds', () => {
    describe('should respond to loud', () => {
        let message, model, mockChannelSend;

        beforeEach(() => {
            mockChannelSend = jest.fn();
            const oldLoud = {
                increment: jest.fn(),
                message: 'MIND',
            };
            const newLoud = {
                increment: jest.fn(),
                message: 'KILLER',
            };
            message = { content: 'FEAR', channel: { send: mockChannelSend } };
            model = {
                Louds: {
                    create: jest.fn().mockName('createLouds'),
                    findOne: jest
                        .fn()
                        .mockResolvedValueOnce(oldLoud)
                        .mockResolvedValueOnce(newLoud)
                        .mockName('findOneLouds'),
                },
                Louds_Banned: {
                    findOne: jest
                        .fn()
                        .mockResolvedValue(false)
                        .mockName('Louds_Banned'),
                },
            };
        });

        test('one time', async () => {
            await louds(message, model);
            const sent = message.channel.send.mock.calls;
            expect(sent).toHaveLength(1);
        });
    });

    test('should not respond to regular message', async () => {
        const mockChannelSend = jest.fn(x => x);
        const message = { content: 'fear', channel: { send: mockChannelSend } };
        await louds(message);
        expect(mockChannelSend.mock.calls).toHaveLength(0);
    });
});
