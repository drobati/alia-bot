import { createContext, createInteraction, createRecord, createTable } from "../utils/testHelpers";
import louds from "./louds";

describe('commands/louds', () => {
    let interaction: any, context: any, Louds: any, Louds_Banned: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        Louds = createTable();
        Louds_Banned = createTable();
        context.tables.Louds = Louds;
        context.tables.Louds_Banned = Louds_Banned;
    });

    it('should handle delete command', async () => {
        interaction.options.getSubcommand.mockReturnValue('delete');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds.destroy.mockResolvedValue(1); // Mocks that one record was deleted
        context.tables.Louds = Louds;

        await louds.execute(interaction, context);

        expect(Louds.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith("I've removed that loud.");
    });

    it('should handle ban command', async () => {
        interaction.options.getSubcommand.mockReturnValue('ban');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds_Banned.findOne.mockResolvedValue(null);
        Louds.findOne.mockResolvedValue(createRecord({ message: 'fake-data' }));
        Louds.destroy.mockResolvedValue(1);

        await louds.execute(interaction, context);

        expect(Louds.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(Louds_Banned.create).toHaveBeenCalledWith({ message: 'fake-data', username: 'fake-user-id' });
        expect(interaction.reply).toHaveBeenCalledWith("I've removed & banned that loud.");
    });

    it('should handle unban command', async () => {
        interaction.options.getSubcommand.mockReturnValue('unban');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds_Banned.findOne.mockResolvedValue(createRecord({ message: 'fake-data' }));
        Louds_Banned.destroy.mockResolvedValue(1);

        await louds.execute(interaction, context);

        expect(Louds.create).toHaveBeenCalledWith({ message: 'fake-data', username: 'fake-user-id' });
        expect(Louds_Banned.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith("I've added & unbanned that loud.");
    });

    it('should reply with error for unrecognized command', async () => {
        interaction.options.getSubcommand.mockReturnValue('garbo');

        await louds.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith("I don't recognize that command.");
    });
});
