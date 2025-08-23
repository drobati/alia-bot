import { createContext, createInteraction, createRecord, createTable } from "../utils/testHelpers";
import louds from "./louds";

describe('commands/louds', () => {
    let interaction: ReturnType<typeof createInteraction>;
    let context: ReturnType<typeof createContext>;
    let Louds: ReturnType<typeof createTable>;
    let Louds_Banned: ReturnType<typeof createTable>;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        Louds = createTable();
        Louds_Banned = createTable();
        context.tables.Louds = Louds;
        context.tables.Louds_Banned = Louds_Banned;
    });

    // Helper function to setup list command tests
    const setupListTest = (limit: number | null, mockLouds: unknown[] = []) => {
        interaction.options.getSubcommand.mockReturnValue('list');
        interaction.options.getInteger.mockReturnValue(limit);
        Louds.findAll.mockResolvedValue(mockLouds);
    };

    const expectListQuery = (expectedLimit: number) => {
        expect(Louds.findAll).toHaveBeenCalledWith({
            limit: expectedLimit,
            order: [['createdAt', 'DESC']],
        });
    };

    it('should handle delete command', async () => {
        interaction.options.getSubcommand.mockReturnValue('delete');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds.destroy.mockResolvedValue(1); // Mocks that one record was deleted
        context.tables.Louds = Louds;

        await louds.execute(interaction as never, context as never);

        expect(Louds.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith("I've removed that loud.");
    });

    it('should handle ban command', async () => {
        interaction.options.getSubcommand.mockReturnValue('ban');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds.findOne.mockResolvedValue(createRecord({ message: 'fake-data' }));
        Louds.destroy.mockResolvedValue(1);
        Louds_Banned.findOrCreate.mockResolvedValue([createRecord({ message: 'fake-data' }), true]);

        await louds.execute(interaction as never, context as never);

        expect(Louds_Banned.findOrCreate).toHaveBeenCalledWith({
            where: { message: 'fake-data' },
            defaults: { message: 'fake-data', username: 'fake-user-id' },
        });
        expect(Louds.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith("I've removed & banned that loud.");
    });

    it('should handle unban command when loud is actually banned', async () => {
        interaction.options.getSubcommand.mockReturnValue('unban');
        interaction.options.getString.mockReturnValue('fake-data');
        const bannedRecord = createRecord({ message: 'fake-data' });
        Louds_Banned.findOne.mockResolvedValue(bannedRecord);
        Louds_Banned.destroy.mockResolvedValue(1);
        Louds.findOrCreate.mockResolvedValue([createRecord({ message: 'fake-data' }), true]);

        await louds.execute(interaction as never, context as never);

        expect(Louds_Banned.findOne).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(Louds.findOrCreate).toHaveBeenCalledWith({
            where: { message: 'fake-data' },
            defaults: { message: 'fake-data', username: 'fake-user-id' },
        });
        expect(Louds_Banned.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith("I've added & unbanned that loud.");
    });

    it('should handle unban command when loud is not banned', async () => {
        interaction.options.getSubcommand.mockReturnValue('unban');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds_Banned.findOne.mockResolvedValue(null); // Not found in banned list

        await louds.execute(interaction as never, context as never);

        expect(Louds_Banned.findOne).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(Louds.findOrCreate).not.toHaveBeenCalled();
        expect(Louds_Banned.destroy).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith("That's not banned.");
    });

    it('should handle count command', async () => {
        interaction.options.getSubcommand.mockReturnValue('count');
        Louds.count.mockResolvedValue(42);

        await louds.execute(interaction as never, context as never);

        expect(Louds.count).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith("I have **42** louds stored.");
    });

    it('should handle count command with singular', async () => {
        interaction.options.getSubcommand.mockReturnValue('count');
        Louds.count.mockResolvedValue(1);

        await louds.execute(interaction as never, context as never);

        expect(interaction.reply).toHaveBeenCalledWith("I have **1** loud stored.");
    });

    describe('list command', () => {
        it('should handle default limit', async () => {
            const mockLouds = [
                { message: 'First loud', createdAt: new Date() },
                { message: 'Second loud', createdAt: new Date() },
            ];
            setupListTest(null, mockLouds);

            await louds.execute(interaction as never, context as never);

            expectListQuery(10);
            expect(interaction.reply).toHaveBeenCalledWith('**2** recent louds:\n1. "First loud"\n2. "Second loud"\n');
        });

        it('should handle custom limit', async () => {
            const mockLouds = [{ message: 'Test loud', createdAt: new Date() }];
            setupListTest(5, mockLouds);

            await louds.execute(interaction as never, context as never);

            expectListQuery(5);
            expect(interaction.reply).toHaveBeenCalledWith('**1** recent loud:\n1. "Test loud"\n');
        });

        it('should handle empty results', async () => {
            setupListTest(null, []);

            await louds.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith("I don't have any louds stored yet.");
        });

        it('should truncate long messages', async () => {
            const longMessage = 'A'.repeat(120); // Message longer than 100 chars
            const mockLouds = [{ message: longMessage, createdAt: new Date() }];
            setupListTest(null, mockLouds);

            await louds.execute(interaction as never, context as never);

            const expectedTruncated = 'A'.repeat(97) + '...';
            expect(interaction.reply).toHaveBeenCalledWith(`**1** recent loud:\n1. "${expectedTruncated}"\n`);
        });
    });

    it('should reply with error for unrecognized command', async () => {
        interaction.options.getSubcommand.mockReturnValue('garbo');

        await louds.execute(interaction as never, context as never);

        expect(interaction.reply).toHaveBeenCalledWith("I don't recognize that command.");
    });
});
