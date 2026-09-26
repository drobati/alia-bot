import { createContext, createInteraction, createTable } from "../utils/testHelpers";
import config from "./config";
import * as passiveChannels from "../utils/passive-channels";

jest.mock("../utils/passive-channels");
const mockSetPassiveChannel = passiveChannels.setPassiveChannel as jest.Mock;
const mockGetPassiveChannels = passiveChannels.getPassiveChannels as jest.Mock;

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

        mockSetPassiveChannel.mockReset().mockResolvedValue(undefined);
        mockGetPassiveChannels.mockReset().mockResolvedValue([]);
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

    describe('logs subcommand group', () => {
        it('should set bot log channel', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('logs');
            interaction.options.getSubcommand.mockReturnValue('channel');
            interaction.options.getChannel.mockReturnValue({ id: '987654321' });
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'log_channel_guild123',
                value: '987654321',
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Bot log channel set to <#987654321>'),
                ephemeral: true,
            });
        });

        it('should show current log channel when configured', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('logs');
            interaction.options.getSubcommand.mockReturnValue('show');
            interaction.guildId = 'guild123';
            interaction.guild = {
                channels: {
                    cache: {
                        get: jest.fn().mockReturnValue({ id: '987654321', name: 'bot-logs' }),
                    },
                },
            };
            Config.findOne.mockResolvedValue({ value: '987654321' });

            await config.execute(interaction, context);

            expect(Config.findOne).toHaveBeenCalledWith({
                where: { key: 'log_channel_guild123' },
            });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Log Channel'),
                ephemeral: true,
            });
        });

        it('should show warning when no log channel configured', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('logs');
            interaction.options.getSubcommand.mockReturnValue('show');
            interaction.guildId = 'guild123';
            Config.findOne.mockResolvedValue(null);

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('No log channel is configured'),
                ephemeral: true,
            });
        });

        it('should show warning when log channel no longer exists', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('logs');
            interaction.options.getSubcommand.mockReturnValue('show');
            interaction.guildId = 'guild123';
            interaction.guild = {
                channels: {
                    cache: {
                        get: jest.fn().mockReturnValue(undefined),
                    },
                },
            };
            Config.findOne.mockResolvedValue({ value: '987654321' });

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('no longer exists'),
                ephemeral: true,
            });
        });
    });

    describe('motivational subcommand group', () => {
        let MotivationalConfig: any;

        beforeEach(() => {
            MotivationalConfig = createTable();
            context.tables.MotivationalConfig = MotivationalConfig;
            interaction.guildId = 'guild123';
        });

        it('should set up motivational messages', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('motivational');
            interaction.options.getSubcommand.mockReturnValue('setup');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123', type: 0 });
            interaction.options.getString
                .mockReturnValueOnce('daily')    // frequency
                .mockReturnValueOnce('motivation') // category
                .mockReturnValueOnce(null);       // schedule (use default)
            MotivationalConfig.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(MotivationalConfig.upsert).toHaveBeenCalledWith(
                expect.objectContaining({
                    channelId: 'chan123',
                    guildId: 'guild123',
                    frequency: 'daily',
                    category: 'motivation',
                    isActive: true,
                }),
                expect.anything(),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Motivational messages configured'),
                    ephemeral: true,
                }),
            );
        });

        it('should disable motivational messages', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('motivational');
            interaction.options.getSubcommand.mockReturnValue('disable');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            MotivationalConfig.findOne.mockResolvedValue({
                update: jest.fn().mockResolvedValue({}),
            });

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('disabled'),
                    ephemeral: true,
                }),
            );
        });

        it('should enable motivational messages', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('motivational');
            interaction.options.getSubcommand.mockReturnValue('enable');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            MotivationalConfig.findOne.mockResolvedValue({
                update: jest.fn().mockResolvedValue({}),
            });

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('enabled'),
                    ephemeral: true,
                }),
            );
        });

        it('should show motivational status', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('motivational');
            interaction.options.getSubcommand.mockReturnValue('status');
            interaction.editReply = jest.fn().mockResolvedValue({});
            MotivationalConfig.findAll.mockResolvedValue([]);

            await config.execute(interaction, context);

            expect(interaction.editReply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('No motivational message configurations'),
                }),
            );
        });

        it('should error when disabling non-existent config', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('motivational');
            interaction.options.getSubcommand.mockReturnValue('disable');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            MotivationalConfig.findOne.mockResolvedValue(null);

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true,
                }),
            );
        });

        it('should error when enabling non-existent config', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('motivational');
            interaction.options.getSubcommand.mockReturnValue('enable');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            MotivationalConfig.findOne.mockResolvedValue(null);

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('error'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('tts subcommand group', () => {
        it('should show TTS configuration', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('tts');
            interaction.options.getSubcommand.mockReturnValue('show');
            interaction.guild = { id: 'guild123' };
            Config.findAll.mockResolvedValue([]);
            context.voiceService = null;

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('TTS Configuration'),
                    ephemeral: true,
                }),
            );
        });

        it('should set default voice', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('tts');
            interaction.options.getSubcommand.mockReturnValue('set-voice');
            interaction.options.getString.mockReturnValue('nova');
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith(
                { key: 'tts_default_voice', value: 'nova' },
                expect.anything(),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('nova'),
                    ephemeral: true,
                }),
            );
        });

        it('should set stability mode', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('tts');
            interaction.options.getSubcommand.mockReturnValue('set-stability');
            interaction.options.getString.mockReturnValue('0.0');
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith(
                { key: 'tts_stability', value: '0.0' },
                expect.anything(),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('Creative'),
                    ephemeral: true,
                }),
            );
        });

        it('should set max length', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('tts');
            interaction.options.getSubcommand.mockReturnValue('set-max-length');
            interaction.options.getInteger.mockReturnValue(2000);
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith(
                { key: 'tts_max_length', value: '2000' },
                expect.anything(),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('2000'),
                    ephemeral: true,
                }),
            );
        });

        it('should reset TTS configuration', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('tts');
            interaction.options.getSubcommand.mockReturnValue('reset');
            Config.destroy.mockResolvedValue(5);

            await config.execute(interaction, context);

            expect(Config.destroy).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({
                    content: expect.stringContaining('reset to defaults'),
                    ephemeral: true,
                }),
            );
        });
    });

    describe('dice subcommand group', () => {
        it('should set max dice', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('dice');
            interaction.options.getSubcommand.mockReturnValue('max-dice');
            interaction.options.getInteger.mockReturnValue(200);
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'dice_max_dice_guild123',
                value: '200',
            });
        });

        it('should set show threshold', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('dice');
            interaction.options.getSubcommand.mockReturnValue('show-threshold');
            interaction.options.getInteger.mockReturnValue(20);
            interaction.guildId = 'guild123';
            Config.upsert.mockResolvedValue([{}, true]);

            await config.execute(interaction, context);

            expect(Config.upsert).toHaveBeenCalledWith({
                key: 'dice_show_individual_guild123',
                value: '20',
            });
        });
    });

    describe('questions subcommand group', () => {
        it('should enable passive question answering for a channel', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('questions');
            interaction.options.getSubcommand.mockReturnValue('enable');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            interaction.guildId = 'guild123';

            await config.execute(interaction, context);

            expect(mockSetPassiveChannel).toHaveBeenCalledWith(context, 'guild123', 'chan123', true);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Passive question answering enabled for <#chan123>.',
                ephemeral: true,
            });
        });

        it('should warn on enable when the bot lacks Embed Links permission', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('questions');
            interaction.options.getSubcommand.mockReturnValue('enable');
            const permissionsFor = jest.fn().mockReturnValue({ has: jest.fn().mockReturnValue(false) });
            interaction.options.getChannel.mockReturnValue({ id: 'chan123', permissionsFor });
            interaction.guildId = 'guild123';
            interaction.guild = { members: { me: { id: 'bot-member' } } };

            await config.execute(interaction, context);

            expect(mockSetPassiveChannel).toHaveBeenCalledWith(context, 'guild123', 'chan123', true);
            expect(permissionsFor).toHaveBeenCalledWith({ id: 'bot-member' });
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Passive question answering enabled for <#chan123>.'),
                ephemeral: true,
            });
            const replyContent = interaction.reply.mock.calls[0][0].content;
            expect(replyContent).toContain('Embed Links');
        });

        it('should not warn on enable when the bot has Embed Links permission', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('questions');
            interaction.options.getSubcommand.mockReturnValue('enable');
            const permissionsFor = jest.fn().mockReturnValue({ has: jest.fn().mockReturnValue(true) });
            interaction.options.getChannel.mockReturnValue({ id: 'chan123', permissionsFor });
            interaction.guildId = 'guild123';
            interaction.guild = { members: { me: { id: 'bot-member' } } };

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Passive question answering enabled for <#chan123>.',
                ephemeral: true,
            });
        });

        it('should disable passive question answering for a channel', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('questions');
            interaction.options.getSubcommand.mockReturnValue('disable');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            interaction.guildId = 'guild123';

            await config.execute(interaction, context);

            expect(mockSetPassiveChannel).toHaveBeenCalledWith(context, 'guild123', 'chan123', false);
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Passive question answering disabled for <#chan123>.',
                ephemeral: true,
            });
        });

        it('should list enabled channels', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('questions');
            interaction.options.getSubcommand.mockReturnValue('list');
            interaction.guildId = 'guild123';
            mockGetPassiveChannels.mockResolvedValue(['chan123', 'chan456']);

            await config.execute(interaction, context);

            expect(mockGetPassiveChannels).toHaveBeenCalledWith(context, 'guild123');
            expect(interaction.reply).toHaveBeenCalledWith({
                content: '**Passive question answering is enabled in:**\n<#chan123>\n<#chan456>',
                ephemeral: true,
            });
        });

        it('should report no channels enabled when the list is empty', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('questions');
            interaction.options.getSubcommand.mockReturnValue('list');
            interaction.guildId = 'guild123';
            mockGetPassiveChannels.mockResolvedValue([]);

            await config.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'Passive question answering is not enabled in any channel.',
                ephemeral: true,
            });
        });

        it('should guard enable/disable/list against use outside a server', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('questions');
            interaction.options.getSubcommand.mockReturnValue('enable');
            interaction.options.getChannel.mockReturnValue({ id: 'chan123' });
            interaction.guildId = null;

            await config.execute(interaction, context);

            expect(mockSetPassiveChannel).not.toHaveBeenCalled();
            expect(mockGetPassiveChannels).not.toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith({
                content: 'This command can only be used in a server.',
                ephemeral: true,
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
