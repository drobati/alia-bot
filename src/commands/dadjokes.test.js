const { createInteraction, createContext } = require('../utils/testHelpers');
const { execute } = require('./dadjokes');
const axios = require('axios');
jest.mock('axios');

describe('commands/dadjokes', () => {
    let interaction, context;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        axios.get.mockResolvedValue({ data: { joke: 'fake-dad-joke' } });
    });

    it('responds with a dad joke', async () => {
        await execute(interaction, context);

        expect(interaction.reply).toBeCalledWith('fake-dad-joke');
        expect(axios.get).toBeCalledWith('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
        });
    });

    it('handles errors gracefully', async () => {
        axios.get.mockRejectedValue(new Error('error'));

        await execute(interaction, context);

        expect(interaction.reply).toBeCalledWith('Sorry, I couldn’t fetch a joke at this time.');
    });
});
