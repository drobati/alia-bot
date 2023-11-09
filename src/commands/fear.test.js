const { execute } = require('./fear');

describe('commands/dadjokes', () => {
    describe('should', () => {
        let interaction = {};

        beforeEach(() => {
            interaction = {
                reply: jest.fn()
            };
        });

        const run = (msg) => {
            return execute(msg);
        };

        it('respond to fear', async () => {
            await run(interaction);
            expect(interaction.reply).toBeCalledTimes(1);
            expect(interaction.reply).toBeCalledWith(
                'I must not fear.\n' +
                'Fear is the mind-killer.\n' +
                'Fear is the little-death that brings total obliteration.\n' +
                'I will face my fear.\n' +
                'I will permit it to pass over me and through me.\n' +
                'And when it has gone past, I will turn the inner eye to see its path.\n' +
                'Where the fear has gone there will be nothing. Only I will remain.');
        });
    });
});
