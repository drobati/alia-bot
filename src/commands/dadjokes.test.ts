import { createContext, createInteraction } from "../utils/testHelpers";
import dadjokes from "./dadjokes";
import axios from "axios";

jest.mock('axios');

describe('commands/dadjokes', () => {
    let interaction: any, context: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        (axios.get as jest.Mock).mockResolvedValue({ data: { joke: 'fake-dad-joke' } });
    });

    it('responds with a dad joke', async () => {
        await dadjokes.execute(interaction, context);

        expect(interaction.reply).toBeCalledWith('fake-dad-joke');
        expect(axios.get).toBeCalledWith('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
        });
    });

    it('handles errors gracefully', async () => {
        (axios.get as jest.Mock).mockRejectedValue(new Error('error'));

        await dadjokes.execute(interaction, context);

        expect(interaction.reply).toBeCalledWith('Sorry, I couldn’t fetch a joke at this time.');
    });
});
