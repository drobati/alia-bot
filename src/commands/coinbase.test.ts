import { createContext, createInteraction } from "../utils/testHelpers";
import coinbase from "./coinbase";
import axios from "axios";

jest.mock('axios');

describe('commands/coinbase', () => {
    let interaction: any, context: any, currencies: any, exchanges;

    beforeEach(() => {
        interaction = createInteraction()
        interaction.options.getFocused.mockReturnValue('BTC');
        interaction.options.get = jest.fn((name: any) => ({
            value: interaction.options[name],
        }));
        interaction.options.getNumber = jest.fn((name: any) => interaction.options[name]);
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
            await coinbase.execute(interaction, context);
            expect(interaction.reply).toHaveBeenCalledWith('1 Bitcoin is 2 United States Dollar.');
        });

        it('responds if exchange rate is not valid', async function () {
            exchanges = { data: { data: { rates: { USD: 0 } } } };
            axios.get = jest.fn().mockResolvedValueOnce(currencies).mockResolvedValueOnce(exchanges);
            interaction.options.source = 'BTC';
            interaction.options.target = 'USD';
            interaction.options.amount = 1;
            await coinbase.execute(interaction, context);
            expect(interaction.reply).toHaveBeenCalledWith(
                'Bitcoin to United States Dollar exchange rate is not valid.',
            );
        });
    });

    describe('autocomplete', () => {
        it('responds with suggestions', async function () {
            await coinbase.autocomplete(interaction, context);
            expect(interaction.respond).toHaveBeenCalled();
        });
    });
});
