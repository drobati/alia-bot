const dadjokes = require('./dadjokes');
const axios = require('axios');
jest.mock('axios');

describe('commands/dadjokes', () => {
    describe('should', () => {
        let message = {};

        beforeEach(() => {
            message = {
                author: { id: '1234', username: 'guy' },
                channel: { send: jest.fn() }
            };
            axios.get.mockResolvedValue({ data: { joke: 'fake-dad-joke' } });
        });

        const run = (msg) => {
            return dadjokes(msg);
        };

        it('respond to dadjoke', async () => {
            await run(message);
            expect(message.channel.send).toBeCalledTimes(1);
            expect(message.channel.send).toBeCalledWith('fake-dad-joke');
        });

        it('throw error if there is an error', async () => {
            axios.get.mockRejectedValue(new Error('error'));
            await expect(run(message)).rejects.toThrow('error');
        });
    });
});
