import { createContext, createInteraction, createTable } from "../utils/testHelpers";
import password from "./password";

describe('commands/password', () => {
    let interaction: any, context: any, Password: any;

    beforeEach(() => {
        interaction = createInteraction();
        interaction.user.id = 'fake-owner';
        interaction.user.username = 'test-owner';
        interaction.guildId = 'guild123';
        interaction.replied = false;
        interaction.deferred = false;
        context = createContext();
        Password = createTable();
        context.tables.Password = Password;
    });

    describe('set subcommand', () => {
        it('should create a password rule', async () => {
            interaction.options.getSubcommand.mockReturnValue('set');
            interaction.options.getRole.mockReturnValue({ id: 'role123' });
            interaction.options.getString.mockReturnValue('SecretWord');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            Password.create.mockResolvedValue({});

            await password.execute(interaction, context);

            expect(Password.create).toHaveBeenCalledWith({
                guildId: 'guild123',
                channelId: 'chan123',
                roleId: 'role123',
                password: 'secretword',
                createdBy: 'fake-owner',
                active: true,
            });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Password rule created'),
                    ephemeral: true,
                }),
            );
        });

        it('should store password as lowercase', async () => {
            interaction.options.getSubcommand.mockReturnValue('set');
            interaction.options.getRole.mockReturnValue({ id: 'role1' });
            interaction.options.getString.mockReturnValue('ALLCAPS');
            interaction.options.getChannel.mockReturnValue({ id: 'chan1' });
            Password.create.mockResolvedValue({});

            await password.execute(interaction, context);

            expect(Password.create).toHaveBeenCalledWith(
                expect.objectContaining({ password: 'allcaps' }),
            );
        });
    });

    describe('list subcommand', () => {
        it('should list active password rules', async () => {
            interaction.options.getSubcommand.mockReturnValue('list');
            Password.findAll.mockResolvedValue([
                { id: 1, channelId: 'chan1', roleId: 'role1', password: 'pass1' },
                { id: 2, channelId: 'chan2', roleId: 'role2', password: 'pass2' },
            ]);

            await password.execute(interaction, context);

            expect(Password.findAll).toHaveBeenCalledWith({
                where: { guildId: 'guild123', active: true },
            });
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Active Password Rules'),
                    ephemeral: true,
                }),
            );
        });

        it('should show message when no rules exist', async () => {
            interaction.options.getSubcommand.mockReturnValue('list');
            Password.findAll.mockResolvedValue([]);

            await password.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'No active password rules for this server.',
                ephemeral: true,
            });
        });
    });

    describe('remove subcommand', () => {
        it('should soft-delete a password rule', async () => {
            interaction.options.getSubcommand.mockReturnValue('remove');
            interaction.options.getInteger.mockReturnValue(5);
            Password.findOne.mockResolvedValue({ id: 5 });
            Password.update.mockResolvedValue([1]);

            await password.execute(interaction, context);

            expect(Password.update).toHaveBeenCalledWith(
                { active: false },
                { where: { id: 5 } },
            );
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Password rule **#5** has been removed.',
                ephemeral: true,
            });
        });

        it('should handle non-existent rule', async () => {
            interaction.options.getSubcommand.mockReturnValue('remove');
            interaction.options.getInteger.mockReturnValue(999);
            Password.findOne.mockResolvedValue(null);

            await password.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'No active password rule found with ID **999**.',
                ephemeral: true,
            });
        });
    });

    it('should reject non-owner users', async () => {
        interaction.user.id = 'non-owner-id';
        interaction.options.getSubcommand.mockReturnValue('list');

        await password.execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('bot owner only'),
                ephemeral: true,
            }),
        );
        expect(Password.findAll).not.toHaveBeenCalled();
    });
});
