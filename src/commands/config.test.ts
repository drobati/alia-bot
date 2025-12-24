import { createContext, createInteraction, createTable } from "../utils/testHelpers";
import config from "./config";

describe('commands/config', () => {
    let interaction: any, context: any, Config: any;

    beforeEach(() => {
        interaction = createInteraction();
        // Set user ID to match owner from test config (config/test.yaml)
        interaction.user.id = 'fake-owner';
        interaction.user.username = 'test-owner';
        context = createContext();
        Config = createTable();
        context.tables.Config = Config;
    });

    describe('general subcommand group', () => {
        it('should add a new configuration', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('general');
            interaction.options.getSubcommand.mockReturnValue('add');
            interaction.options.getString.mockReturnValueOnce('fake-key').mockReturnValueOnce('fake-value');
            Config.upsert.mockResolvedValue([{}, true]);
            context.tables.Config = Config;

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({ key: 'fake-key', value: 'fake-value' }, expect.anything());
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Configuration for `fake-key` has been added.',
                ephemeral: true,
            });
        });

        it('should update an existing configuration', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('general');
            interaction.options.getSubcommand.mockReturnValue('add');
            interaction.options.getString.mockReturnValueOnce('fake-key').mockReturnValueOnce('fake-value');
            Config.upsert.mockResolvedValue([{}, false]);
            context.tables.Config = Config;

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({ key: 'fake-key', value: 'fake-value' }, expect.anything());
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Configuration for `fake-key` has been updated.',
                ephemeral: true,
            });
        });

        it('should remove a configuration', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('general');
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
            interaction.options.getSubcommandGroup.mockReturnValue('general');
            interaction.options.getSubcommand.mockReturnValue('remove');
            interaction.options.getString.mockReturnValue('fake-key');
            Config.findOne.mockResolvedValue(null);
            context.tables.Config = Config;

            await config.execute(interaction, context);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'An error occurred: No configuration found for key `fake-key`.',
                ephemeral: true,
            });
        });
    });

    describe('welcome subcommand group', () => {
        it('should set welcome channel', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('welcome');
            interaction.options.getSubcommand.mockReturnValue('channel');
            interaction.options.getChannel.mockReturnValue({ id: '123456789' });
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'welcome_channel_guild123',
                value: '123456789',
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Welcome channel set to <#123456789>.',
                ephemeral: true,
            });
        });

        it('should set welcome message', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('welcome');
            interaction.options.getSubcommand.mockReturnValue('message');
            interaction.options.getString.mockReturnValue('Welcome {user} to {server}!');
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'welcome_message_guild123',
                value: 'Welcome {user} to {server}!',
            });
        });
    });

    describe('verify subcommand group', () => {
        it('should set verification expiration', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('verify');
            interaction.options.getSubcommand.mockReturnValue('expiration');
            interaction.options.getString.mockReturnValue('24h');
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'verify_expiration_guild123',
                value: '86400',
            });
        });

        it('should handle invalid duration format', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('verify');
            interaction.options.getSubcommand.mockReturnValue('expiration');
            interaction.options.getString.mockReturnValue('invalid');
            interaction.guildId = 'guild123';

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "Invalid duration format. Use format like `24h`, `7d`, or `2w` (hours, days, weeks).",
                ephemeral: true,
            });
        });

        it('should set allowed roles', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('verify');
            interaction.options.getSubcommand.mockReturnValue('allowed-roles');
            interaction.options.getRole = jest.fn()
                .mockReturnValueOnce({ id: 'role1' })
                .mockReturnValueOnce({ id: 'role2' })
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null)
                .mockReturnValueOnce(null);
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'verify_allowed_roles_guild123',
                value: JSON.stringify(['role1', 'role2']),
            });
        });

        it('should set log channel', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('verify');
            interaction.options.getSubcommand.mockReturnValue('log-channel');
            interaction.options.getChannel.mockReturnValue({ id: '987654321' });
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'verify_log_channel_guild123',
                value: '987654321',
            });
        });
    });

    it('should reject non-owner users', async () => {
        // Set user ID to a non-owner
        interaction.user.id = 'non-owner-id';
        interaction.user.username = 'non-owner';
        interaction.options.getSubcommand.mockReturnValue('add');
        interaction.options.getString.mockReturnValueOnce('fake-key').mockReturnValueOnce('fake-value');

        await config.execute(interaction, context);

        // Should show unauthorized message
        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({
                content: expect.stringContaining('This command is restricted to the bot owner only'),
                ephemeral: true,
            }),
        );
        // Should not have called upsert
        expect(Config.upsert).not.toHaveBeenCalled();
    });
});
