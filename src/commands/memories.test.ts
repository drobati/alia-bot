import { createContext, createInteraction, createRecord, createTable } from "../utils/testHelpers";
import memories from "./memories";
import { stripIndent } from "common-tags";

describe('commands/memories', () => {
    let interaction: any, context: any, Memories;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        Memories = createTable();
        context.tables.Memories = Memories;
    });

    it('should retrieve a memory', async () => {
        interaction.options.getSubcommand.mockReturnValue('get');
        interaction.options.getString.mockReturnValue('key1');
        context.tables.Memories.findOne.mockResolvedValue(
            createRecord({ key: 'key1', value: 'value1', read_count: 1 }),
        );
        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('"key1" is "value1".');
    });

    it('should add a new memory', async () => {
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockReturnValueOnce('key1').mockReturnValueOnce('value1');
        context.tables.Memories.findOne.mockResolvedValue(null);

        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('"key1" is now "value1".');
    });

    it('should delete a memory', async () => {
        interaction.options.getSubcommand.mockReturnValue('delete');
        interaction.options.getString.mockReturnValue('key1');
        context.tables.Memories.findOne.mockResolvedValue(
            createRecord({ key: 'key1', value: 'value1' }));

        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('Forgotten: "key1".');
    });

    it('should return top memories', async () => {
        interaction.options.getSubcommand.mockReturnValue('top');
        interaction.options.getInteger.mockReturnValue(5);
        context.tables.Memories.findAll.mockResolvedValue([
            { key: 'key1', value: 'value1', read_count: 10 },
            { key: 'key2', value: 'value2', read_count: 5 },
        ]);

        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith(stripIndent`
            Top 5 Memories:
             * "key1" - Accessed 10 times
             * "key2" - Accessed 5 times
        ` + '\n'); // stripIndent removes the trailing newline
    });

    it('should return random memories', async () => {
        interaction.options.getSubcommand.mockReturnValue('random');
        interaction.options.getInteger.mockReturnValue(2);
        context.tables.Memories.findAll.mockResolvedValue([
            { key: 'key1', value: 'value1' },
            { key: 'key2', value: 'value2' },
        ]);

        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith(stripIndent`
            Random 2 Memories:
             * "key1" - "value1"
             * "key2" - "value2"
        ` + '\n'); // stripIndent removes the trailing newline
    });

    it('should trigger a memory', async () => {
        interaction.options.getSubcommand.mockReturnValue('trigger');
        interaction.options.getString.mockReturnValue('key1');
        context.tables.Memories.findOne.mockResolvedValue(
            createRecord({ key: 'key1', value: 'value1', update: jest.fn() }));

        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('"key1" is now triggered.');
    });

    it('should untrigger a memory', async () => {
        interaction.options.getSubcommand.mockReturnValue('untrigger');
        interaction.options.getString.mockReturnValue('key1');
        context.tables.Memories.findOne.mockResolvedValue(
            createRecord({ key: 'key1', value: 'value1', update: jest.fn() }));

        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith('"key1" is now untriggered.');
    });

    it('should handle unrecognized command', async () => {
        interaction.options.getSubcommand.mockReturnValue('unknown');

        await memories.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith("I don't recognize that command.");
    });
});
