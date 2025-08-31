import { SlashCommandBuilder } from 'discord.js';
import ttsConfigCommand from './tts-config';
import { Context } from '../utils/types';
import config from 'config';

// Mock config
jest.mock('config');
const mockConfig = config as jest.Mocked<typeof config>;

describe('tts-config command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockConfigModel: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfigModel = {
            upsert: jest.fn(),
            findAll: jest.fn(),
            destroy: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'test-owner-id', username: 'testowner' },
            guild: { id: 'test-guild-id' },
            reply: jest.fn(),
            followUp: jest.fn(),
            options: {
                getSubcommand: jest.fn(),
                getString: jest.fn(),
                getInteger: jest.fn(),
            },
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            sequelize: {
                transaction: jest.fn(callback => callback({})),
            },
            tables: {
                Config: mockConfigModel,
            },
            voiceService: {
                isConnectedToVoice: jest.fn(),
            },
        } as any;

        mockConfig.get.mockImplementation((key: string) => {
            if (key === 'owner') {return 'test-owner-id';}
            return undefined;
        });
    });

    it('should have correct command data', () => {
        expect(ttsConfigCommand.data).toBeInstanceOf(SlashCommandBuilder);
        expect(ttsConfigCommand.data.name).toBe('tts-config');
        expect(ttsConfigCommand.data.description).toContain('Owner only');
    });

    it('should reject non-owner users', async () => {
        mockInteraction.user.id = 'not-owner';

        await ttsConfigCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: `❌ This command is restricted to the bot owner only.\n` +
                    `**Debug Info:**\n` +
                    `Your ID: \`not-owner\`\n` +
                    `Owner ID: \`test-owner-id\`\n` +
                    `Match: ❌`,
            ephemeral: true,
        });
    });

    describe('show subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('show');
        });

        it('should show default config when no settings exist', async () => {
            mockConfigModel.findAll.mockResolvedValue([]);
            mockContext.voiceService!.isConnectedToVoice = jest.fn().mockReturnValue(false);

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('📢 TTS Configuration'),
                ephemeral: true,
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('🔴 Disconnected'),
                ephemeral: true,
            });
        });

        it('should show custom config when settings exist', async () => {
            const mockConfigs = [
                { key: 'tts_default_voice', value: 'nova' },
                { key: 'tts_max_length', value: '2000' },
            ];
            mockConfigModel.findAll.mockResolvedValue(mockConfigs);
            mockContext.voiceService!.isConnectedToVoice = jest.fn().mockReturnValue(true);

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('🟢 Connected'),
                ephemeral: true,
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('nova'),
                ephemeral: true,
            });
        });

        it('should handle no voice service', async () => {
            mockConfigModel.findAll.mockResolvedValue([]);
            mockContext.voiceService = undefined;

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('🔴 Not initialized'),
                ephemeral: true,
            });
        });
    });

    describe('set-voice subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('set-voice');
            mockInteraction.options.getString.mockReturnValue('echo');
        });

        it('should set default voice successfully', async () => {
            mockConfigModel.upsert.mockResolvedValue([{}, true]);

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockContext.sequelize.transaction).toHaveBeenCalled();
            expect(mockConfigModel.upsert).toHaveBeenCalledWith(
                { key: 'tts_default_voice', value: 'echo' },
                { transaction: {} },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '✅ Default TTS voice set to **echo**',
                ephemeral: true,
            });
        });
    });

    describe('set-max-length subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('set-max-length');
        });

        it('should set max length successfully', async () => {
            mockInteraction.options.getInteger.mockReturnValue(3000);
            mockConfigModel.upsert.mockResolvedValue([{}, true]);

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockConfigModel.upsert).toHaveBeenCalledWith(
                { key: 'tts_max_length', value: '3000' },
                { transaction: {} },
            );
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '✅ TTS max text length set to **3000** characters',
                ephemeral: true,
            });
        });

        it('should reject length too small', async () => {
            mockInteraction.options.getInteger.mockReturnValue(0);

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Max length must be between 1 and 4096 characters.',
                ephemeral: true,
            });
        });

        it('should reject length too large', async () => {
            mockInteraction.options.getInteger.mockReturnValue(5000);

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '❌ Max length must be between 1 and 4096 characters.',
                ephemeral: true,
            });
        });
    });

    describe('reset subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('reset');
        });

        it('should reset all TTS config successfully', async () => {
            mockConfigModel.destroy.mockResolvedValue(3);

            await ttsConfigCommand.execute(mockInteraction, mockContext);

            expect(mockConfigModel.destroy).toHaveBeenCalledWith({
                where: {
                    key: [
                        'tts_default_voice',
                        'tts_max_length',
                        'tts_rate_limit_cooldown',
                        'tts_allowed_users',
                        'tts_auto_join',
                    ],
                },
                transaction: {},
            });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '✅ All TTS configuration has been reset to defaults.',
                ephemeral: true,
            });
        });
    });

    it('should handle unknown subcommand', async () => {
        mockInteraction.options.getSubcommand.mockReturnValue('unknown');

        await ttsConfigCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Unknown subcommand',
            ephemeral: true,
        });
    });

    it('should handle general errors with reply', async () => {
        const generalError = new Error('General error');
        mockInteraction.options.getSubcommand.mockImplementation(() => {
            throw generalError;
        });

        await ttsConfigCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Error executing tts-config command',
            expect.objectContaining({
                userId: 'test-owner-id',
                error: generalError,
            }),
        );
        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ An error occurred: General error',
            ephemeral: true,
        });
    });

    it('should handle errors when reply fails', async () => {
        const generalError = new Error('General error');
        mockInteraction.options.getSubcommand.mockImplementation(() => {
            throw generalError;
        });
        mockInteraction.reply.mockRejectedValue(new Error('Reply failed'));
        mockInteraction.followUp.mockResolvedValue(undefined);

        await ttsConfigCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ An error occurred: General error',
            ephemeral: true,
        });
    });

    it('should handle errors when both reply and followUp fail', async () => {
        const generalError = new Error('General error');
        mockInteraction.options.getSubcommand.mockImplementation(() => {
            throw generalError;
        });
        mockInteraction.reply.mockRejectedValue(new Error('Reply failed'));
        mockInteraction.followUp.mockRejectedValue(new Error('FollowUp failed'));

        await ttsConfigCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.error).toHaveBeenCalledWith('Failed to send error response for tts-config command');
    });

    it('should log command execution', async () => {
        mockInteraction.options.getSubcommand.mockReturnValue('show');
        mockConfigModel.findAll.mockResolvedValue([]);

        await ttsConfigCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.info).toHaveBeenCalledWith(
            'TTS config command executed',
            expect.objectContaining({
                userId: 'test-owner-id',
                username: 'testowner',
                subcommand: 'show',
            }),
        );
    });
});