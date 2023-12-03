import { createContext, createInteraction, createTable } from "../utils/testHelpers";
import config from "./config";

describe('commands/config', () => {
    let interaction: any, context: any, Config: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        Config = createTable();
        context.tables.Config = Config;
    });

    it('should add a new configuration', async () => {
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockReturnValueOnce('fake-key').mockReturnValueOnce('fake-value');
        Config.upsert.mockResolvedValue([{}, true]); // Mocks the upsert method to return 'created' flag as true
        context.tables.Config = Config;

        await config.execute(interaction, context);

        expect(Config.upsert).toHaveBeenCalledWith({ key: 'fake-key', value: 'fake-value' }, expect.anything());
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Configuration for `fake-key` has been added.',
            ephemeral: true,
        });
    });

    it('should update an existing configuration', async () => {
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockReturnValueOnce('fake-key').mockReturnValueOnce('fake-value');
        Config.upsert.mockResolvedValue([{}, false]); // Mocks the upsert method to return 'created' flag as false
        context.tables.Config = Config;

        await config.execute(interaction, context);

        expect(Config.upsert).toHaveBeenCalledWith({ key: 'fake-key', value: 'fake-value' }, expect.anything());
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Configuration for `fake-key` has been updated.',
            ephemeral: true,
        });
    });

    it('should remove a configuration', async () => {
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockReturnValue('fake-key');
        Config.findOne.mockResolvedValue({ destroy: jest.fn() });
        context.tables.Config = Config;

        await config.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'Configuration for `fake-key` has been removed.',
            ephemeral: true,
        });
    });

    it('should handle removing a non-existent configuration', async () => {
        interaction.options.getSubcommand.mockReturnValue('remove');
        interaction.options.getString.mockReturnValue('fake-key');
        Config.findOne.mockResolvedValue(null);
        context.tables.Config = Config;

        await config.execute(interaction, context)
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'An error occurred: No configuration found for key `fake-key`.',
            ephemeral: true,
        });
    });
});
