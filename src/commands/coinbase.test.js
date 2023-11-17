const { execute, autocomplete } = require('./coinbase');
const { createInteraction, createContext } = require('../utils/testHelpers');
const axios = require('axios');
jest.mock('axios');

describe('commands/coinbase', () => {
    let interaction, context, currencies, exchanges;

    beforeEach(() => {
        interaction = createInteraction()
        interaction.options.getFocused.mockReturnValue('BTC');
        interaction.options.get = jest.fn(name => ({ value: interaction.options[name] }));
        interaction.options.getNumber = jest.fn(name => interaction.options[name]);
        context = createContext();
        currencies = { data: { data: [{ id: 'USD', name: 'United States Dollar' }, { id: 'BTC', name: 'Bitcoin' }] } };
        exchanges = { data: { data: { rates: { USD: 2 } } } };
        axios.get = jest.fn().mockResolvedValueOnce(currencies).mockResolvedValueOnce(exchanges);
    });

    describe('execute', () => {
        it('responds if successful', async function () {
            interaction.options.source = 'BTC';
            interaction.options.target = 'USD';
            interaction.options.amount = 1;
            await execute(interaction, context);
            expect(interaction.reply).toHaveBeenCalledWith('1 Bitcoin is 2 United States Dollar.');
        });

        it('responds if exchange rate is not valid', async function () {
            exchanges = { data: { data: { rates: { USD: 0 } } } };
            axios.get = jest.fn().mockResolvedValueOnce(currencies).mockResolvedValueOnce(exchanges);
            interaction.options.source = 'BTC';
            interaction.options.target = 'USD';
            interaction.options.amount = 1;
            await execute(interaction, context);
            expect(interaction.reply).toHaveBeenCalledWith(
                'Bitcoin to United States Dollar exchange rate is not valid.',
            );
        });
    });

    describe('autocomplete', () => {
        it('responds with suggestions', async function () {
            await autocomplete(interaction, context);
            expect(interaction.respond).toHaveBeenCalled();
        });
    });
});
