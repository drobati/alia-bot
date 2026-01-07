import { createContext, createInteraction } from "../utils/testHelpers";
import no from "./no";
import axios from "axios";

jest.mock('axios');

describe('commands/no', () => {
    let interaction: ReturnType<typeof createInteraction>;
    let context: ReturnType<typeof createContext>;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        (axios.get as jest.Mock).mockResolvedValue({ data: { reason: 'I was reading tea leaves and they said no.' } });
    });

    it('responds with a rejection reason', async () => {
        await no.execute(interaction as never, context as never);

        expect(interaction.reply).toBeCalledWith('I was reading tea leaves and they said no.');
        expect(axios.get).toBeCalledWith('https://naas.isalman.dev/no', {
            headers: { Accept: 'application/json', 'User-Agent': 'Alia Discord Bot' },
        });
    });

    it('handles errors gracefully', async () => {
        (axios.get as jest.Mock).mockRejectedValue(new Error('error'));

        await no.execute(interaction as never, context as never);

        expect(interaction.reply).toBeCalledWith('No. (And the API is down too.)');
    });
});
