import { createInteraction } from "../utils/testHelpers";
import fear from "./fear";

describe('commands/fear', () => {
    let interaction: any;

    beforeEach(() => {
        // Create a mock interaction using your test helper
        interaction = createInteraction();
    });

    it('responds to fear', async () => {
        await fear.execute(interaction);

        // Check that the reply function has been called correctly
        expect(interaction.reply).toBeCalledTimes(1);
        expect(interaction.reply).toBeCalledWith({
            content: 'I must not fear.\n' +
                'Fear is the mind-killer.\n' +
                'Fear is the little-death that brings total obliteration.\n' +
                'I will face my fear.\n' +
                'I will permit it to pass over me and through me.\n' +
                'And when it has gone past, I will turn the inner eye to see its path.\n' +
                'Where the fear has gone there will be nothing. Only I will remain.',
            ephemeral: true,
        });
    });
});