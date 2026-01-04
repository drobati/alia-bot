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

    // Helper function to setup owner permission for tests
    const setupOwnerPermission = () => {
        interaction.user.id = 'fake-owner'; // Matches config/test.yaml owner setting
    };

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

    it('should handle delete command with confirmation', async () => {
        setupOwnerPermission();
        interaction.options.getSubcommand.mockReturnValue('delete');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds.findOne.mockResolvedValue(createRecord({ message: 'fake-data' }));
        Louds.destroy.mockResolvedValue(1);
        context.tables.Louds = Louds;

        // Mock the confirmation flow
        const mockConfirmation = { customId: 'confirm_delete', update: jest.fn() };
        const mockResponse = { awaitMessageComponent: jest.fn().mockResolvedValue(mockConfirmation) };
        interaction.reply.mockResolvedValue(mockResponse);

        await louds.execute(interaction as never, context as never);

        expect(Louds.findOne).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith(expect.objectContaining({
            content: expect.stringContaining('Are you sure you want to delete this loud?'),
            ephemeral: true,
        }));
    });

    it('should handle delete when loud not found', async () => {
        setupOwnerPermission();
        interaction.options.getSubcommand.mockReturnValue('delete');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds.findOne.mockResolvedValue(null);
        context.tables.Louds = Louds;

        await louds.execute(interaction as never, context as never);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: "I couldn't find that loud.",
            ephemeral: true,
        });
    });

    it('should handle ban command', async () => {
        setupOwnerPermission();
        interaction.options.getSubcommand.mockReturnValue('ban');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds.findOne.mockResolvedValue(createRecord({ message: 'fake-data' }));
        Louds.destroy.mockResolvedValue(1);
        Louds_Banned.findOrCreate.mockResolvedValue([createRecord({ message: 'fake-data' }), true]);

        await louds.execute(interaction as never, context as never);

        expect(Louds_Banned.findOrCreate).toHaveBeenCalledWith({
            where: { message: 'fake-data' },
            defaults: { message: 'fake-data', username: 'fake-owner' },
        });
        expect(Louds.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith({
            content: "I've removed & banned that loud.",
            ephemeral: true,
        });
    });

    it('should handle unban command when loud is actually banned', async () => {
        setupOwnerPermission();
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
            defaults: { message: 'fake-data', username: 'fake-owner' },
        });
        expect(Louds_Banned.destroy).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(interaction.reply).toHaveBeenCalledWith({
            content: "I've added & unbanned that loud.",
            ephemeral: true,
        });
    });

    it('should handle unban command when loud is not banned', async () => {
        setupOwnerPermission();
        interaction.options.getSubcommand.mockReturnValue('unban');
        interaction.options.getString.mockReturnValue('fake-data');
        Louds_Banned.findOne.mockResolvedValue(null); // Not found in banned list

        await louds.execute(interaction as never, context as never);

        expect(Louds_Banned.findOne).toHaveBeenCalledWith({ where: { message: 'fake-data' } });
        expect(Louds.findOrCreate).not.toHaveBeenCalled();
        expect(Louds_Banned.destroy).not.toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: "That's not banned.",
            ephemeral: true,
        });
    });

    it('should handle count command', async () => {
        interaction.options.getSubcommand.mockReturnValue('count');
        Louds.count.mockResolvedValue(42);

        await louds.execute(interaction as never, context as never);

        expect(Louds.count).toHaveBeenCalled();
        expect(interaction.reply).toHaveBeenCalledWith({
            content: "I have **42** louds stored.",
            ephemeral: true,
        });
    });

    it('should handle count command with singular', async () => {
        interaction.options.getSubcommand.mockReturnValue('count');
        Louds.count.mockResolvedValue(1);

        await louds.execute(interaction as never, context as never);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: "I have **1** loud stored.",
            ephemeral: true,
        });
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
            expect(interaction.reply).toHaveBeenCalledWith({
                content: '**2** recent louds:\n1. "First loud"\n2. "Second loud"\n',
                ephemeral: true,
            });
        });

        it('should handle custom limit', async () => {
            const mockLouds = [{ message: 'Test loud', createdAt: new Date() }];
            setupListTest(5, mockLouds);

            await louds.execute(interaction as never, context as never);

            expectListQuery(5);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: '**1** recent loud:\n1. "Test loud"\n',
                ephemeral: true,
            });
        });

        it('should handle empty results', async () => {
            setupListTest(null, []);

            await louds.execute(interaction as never, context as never);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "I don't have any louds stored yet.",
                ephemeral: true,
            });
        });

        it('should truncate long messages', async () => {
            const longMessage = 'A'.repeat(120); // Message longer than 100 chars
            const mockLouds = [{ message: longMessage, createdAt: new Date() }];
            setupListTest(null, mockLouds);

            await louds.execute(interaction as never, context as never);

            const expectedTruncated = 'A'.repeat(97) + '...';
            expect(interaction.reply).toHaveBeenCalledWith({
                content: `**1** recent loud:\n1. "${expectedTruncated}"\n`,
                ephemeral: true,
            });
        });
    });

    it('should reply with error for unrecognized command', async () => {
        interaction.options.getSubcommand.mockReturnValue('garbo');

        await louds.execute(interaction as never, context as never);

        expect(interaction.reply).toHaveBeenCalledWith({
            content: "I don't recognize that command.",
            ephemeral: true,
        });
    });
});
