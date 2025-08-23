import { createContext, createInteraction } from "../utils/testHelpers";
import dadjokes from "./dadjokes";
import axios from "axios";

jest.mock('axios');

describe('commands/dadjokes', () => {
    let interaction: ReturnType<typeof createInteraction>;
    let context: ReturnType<typeof createContext>;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        (axios.get as jest.Mock).mockResolvedValue({ data: { joke: 'fake-dad-joke' } });
    });

    it('responds with a dad joke', async () => {
        await dadjokes.execute(interaction as never, context as never);

        expect(interaction.reply).toBeCalledWith('fake-dad-joke');
        expect(axios.get).toBeCalledWith('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
        });
    });

    it('handles errors gracefully', async () => {
        (axios.get as jest.Mock).mockRejectedValue(new Error('error'));

        await dadjokes.execute(interaction as never, context as never);

        expect(interaction.reply).toBeCalledWith('Sorry, I could not fetch a joke at this time.');
    });
});
