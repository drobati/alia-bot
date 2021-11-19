const dadjokes = require('./dadjokes');
const axios = require('axios');
jest.mock('axios');

describe('commands/dadjokes', () => {
    describe('should', () => {
        let message = {};

        beforeEach(() => {
            message = {
                author: { id: '1234', username: 'guy' },
                channel: { send: jest.fn().mockName('send') },
                reply: jest.fn().mockResolvedValue(true).mockName('reply')
            };
            axios.get.mockResolvedValue({ data: { joke: 'fake-dad-joke' } });
        });

        const run = (msg) => {
            return dadjokes(msg);
        };

        it('respond to dadjoke', async () => {
            await run(message);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('fake-dad-joke');
        });

        it('responds to dadjoke with error if has error', async () => {
            axios.get.mockRejectedValue(new Error('error'));
            await run(message);
            const reply = message.reply;
            expect(reply).toBeCalledTimes(1);
            expect(reply).toBeCalledWith('There was an error.');
        });
    });
});
