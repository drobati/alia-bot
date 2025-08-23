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

    it('should handle count command', async () => {
        interaction.options.getSubcommand.mockReturnValue('count');
        Louds.count.mockResolvedValue(42);

        await louds.execute(interaction, context);

        expect(Louds.count).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith("I have **42** louds stored.");
    });

    it('should handle count command with singular', async () => {
        interaction.options.getSubcommand.mockReturnValue('count');
        Louds.count.mockResolvedValue(1);

        await louds.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith("I have **1** loud stored.");
    });

    it('should handle list command with default limit', async () => {
        interaction.options.getSubcommand.mockReturnValue('list');
        interaction.options.getInteger.mockReturnValue(null); // Default limit
        const mockLouds = [
            { message: 'First loud', createdAt: new Date() },
            { message: 'Second loud', createdAt: new Date() },
        ];
        Louds.findAll.mockResolvedValue(mockLouds);

        await louds.execute(interaction, context);

        expect(Louds.findAll).toHaveBeenCalledWith({
            limit: 10,
            order: [['createdAt', 'DESC']],
        });
        expect(interaction.reply).toHaveBeenCalledWith('**2** recent louds:\n1. "First loud"\n2. "Second loud"\n');
    });

    it('should handle list command with custom limit', async () => {
        interaction.options.getSubcommand.mockReturnValue('list');
        interaction.options.getInteger.mockReturnValue(5);
        const mockLouds = [
            { message: 'Test loud', createdAt: new Date() },
        ];
        Louds.findAll.mockResolvedValue(mockLouds);

        await louds.execute(interaction, context);

        expect(Louds.findAll).toHaveBeenCalledWith({
            limit: 5,
            order: [['createdAt', 'DESC']],
        });
        expect(interaction.reply).toHaveBeenCalledWith('**1** recent loud:\n1. "Test loud"\n');
    });

    it('should handle list command with no louds', async () => {
        interaction.options.getSubcommand.mockReturnValue('list');
        interaction.options.getInteger.mockReturnValue(null);
        Louds.findAll.mockResolvedValue([]);

        await louds.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith("I don't have any louds stored yet.");
    });

    it('should handle list command with long messages', async () => {
        interaction.options.getSubcommand.mockReturnValue('list');
        interaction.options.getInteger.mockReturnValue(null);
        const longMessage = 'A'.repeat(120); // Message longer than 100 chars
        const mockLouds = [
            { message: longMessage, createdAt: new Date() },
        ];
        Louds.findAll.mockResolvedValue(mockLouds);

        await louds.execute(interaction, context);

        const expectedTruncated = 'A'.repeat(97) + '...';
        expect(interaction.reply).toHaveBeenCalledWith(`**1** recent loud:\n1. "${expectedTruncated}"\n`);
    });

    it('should reply with error for unrecognized command', async () => {
        interaction.options.getSubcommand.mockReturnValue('garbo');

        await louds.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith("I don't recognize that command.");
    });
});
