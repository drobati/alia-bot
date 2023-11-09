const { execute } = require('./dadjokes');
const axios = require('axios');
jest.mock('axios');

describe('commands/dadjokes', () => {
    describe('should', () => {
        let interaction = {};

        beforeEach(() => {
            interaction = {
                author: { id: '1234', username: 'guy' },
                reply: jest.fn()
            };
            axios.get.mockResolvedValue({ data: { joke: 'fake-dad-joke' } });
        });

        const run = (msg) => {
            return execute(msg);
        };

        it('respond to dadjoke', async () => {
            await run(interaction);
            expect(interaction.reply).toBeCalledTimes(1);
            expect(interaction.reply).toBeCalledWith('fake-dad-joke');
        });

        it('throw error if there is an error', async () => {
            axios.get.mockRejectedValue(new Error('error'));
            await expect(run(interaction)).rejects.toThrow('error');
        });
    });
});
