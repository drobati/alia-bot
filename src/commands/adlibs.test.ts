const { createInteraction, createTable, createRecord } = require('../utils/testHelpers');
const { execute } = require('./adlibs');

describe('commands/adlibs', () => {
    let interaction, Adlibs;

    beforeEach(() => {
        interaction = createInteraction();
        interaction.options.getFocused.mockReturnValue('BTC')
        Adlibs = createTable();
    });

    it("I've added that adlib.", async () => {
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockReturnValue('fake-value');
        Adlibs.findOne.mockResolvedValue(null);

        await execute(interaction, { tables: { Adlibs } });
        expect(interaction.reply).toHaveBeenCalledWith("I've added that adlib.");
    });

    it('That adlib already exists.', async () => {
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockReturnValue('fake-value');
        Adlibs.findOne.mockResolvedValue({ value: 'fake-value' });

        await execute(interaction, { tables: { Adlibs } });
        expect(interaction.reply).toHaveBeenCalledWith('That adlib already exists.');
    });

    it("I've removed that adlib.", async () => {
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockReturnValue('fake-value');
        Adlibs.findOne.mockResolvedValue(createRecord({ value: 'fake-value' }));

        await execute(interaction, { tables: { Adlibs } });
        expect(interaction.reply).toHaveBeenCalledWith("I've removed that adlib.");
    });

    it("I don't recognize that adlib.", async () => {
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockReturnValue('fake-value');
        Adlibs.findOne.mockResolvedValue(null);

        await execute(interaction, { tables: { Adlibs } });
        expect(interaction.reply).toHaveBeenCalledWith("I don't recognize that adlib.");
    });

    it("I don't recognize that command.", async () => {
        interaction.options.getSubcommand.mockReturnValue('unknown');

        await execute(interaction, { tables: { Adlibs } });
        expect(interaction.reply).toHaveBeenCalledWith("I don't recognize that command.");
    });
});
