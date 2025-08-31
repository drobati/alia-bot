import { SlashCommandBuilder } from 'discord.js';
import speakCommand from './speak';
import { Context } from '../utils/types';
import config from 'config';

// Mock config
jest.mock('config');
const mockConfig = config as jest.Mocked<typeof config>;

describe('speak command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockVoiceService: any;
    let mockMember: any;
    let mockVoiceChannel: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockVoiceChannel = {
            id: 'test-voice-channel',
            name: 'Test Voice Channel',
        };

        mockMember = {
            voice: {
                channel: mockVoiceChannel,
            },
        };

        mockVoiceService = {
            isConnectedToVoice: jest.fn(),
            joinVoiceChannel: jest.fn(),
            getUserVoiceChannel: jest.fn(),
            speakText: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'test-owner-id', username: 'testowner' },
            guild: { id: 'test-guild-id' },
            member: mockMember,
            reply: jest.fn(),
            deferReply: jest.fn(),
            followUp: jest.fn(),
            options: {
                getString: jest.fn(),
                getBoolean: jest.fn(),
            },
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            voiceService: mockVoiceService,
        } as any;

        mockConfig.get.mockImplementation((key: string) => {
            if (key === 'owner') {return 'test-owner-id';}
            return undefined;
        });
    });

    it('should have correct command data', () => {
        expect(speakCommand.data).toBeInstanceOf(SlashCommandBuilder);
        expect(speakCommand.data.name).toBe('speak');
        expect(speakCommand.data.description).toContain('Owner only');
    });

    it('should reject non-owner users', async () => {
        mockInteraction.user.id = 'not-owner';

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ This command is restricted to the bot owner only.',
            ephemeral: true,
        });
    });

    it('should handle missing voice service', async () => {
        mockContext.voiceService = undefined;

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Voice service not initialized. Please restart the bot.',
            ephemeral: true,
        });
    });

    it('should handle text too long', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'x'.repeat(5000);} // Too long
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Text is too long. Maximum length is 4096 characters.',
            ephemeral: true,
        });
    });

    it('should handle empty text', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return '';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Please provide some text to speak.',
            ephemeral: true,
        });
    });

    it('should handle missing guild', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockInteraction.guild = null;

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ This command can only be used in a server.',
            ephemeral: true,
        });
    });

    it('should handle join_user with no voice channel', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(true); // join_user = true
        mockVoiceService.getUserVoiceChannel.mockReturnValue(null);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ You need to be in a voice channel for me to join you.',
            ephemeral: true,
        });
    });

    it('should handle join_user with voice channel join error', async () => {
        const joinError = new Error('Join failed');
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(true);
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.joinVoiceChannel.mockRejectedValue(joinError);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Failed to join voice channel: Join failed',
            ephemeral: true,
        });
    });

    it('should handle not connected to voice', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Bot is not connected to any voice channel. Use `/join` first or set `join_user` to true.',
            ephemeral: true,
        });
    });

    it('should successfully speak text', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'nova';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockResolvedValue(undefined);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockVoiceService.speakText).toHaveBeenCalledWith('Hello world', 'test-guild-id', 'nova');
        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '✅ Successfully spoke text using nova voice.',
            ephemeral: true,
        });
        expect(mockContext.log.info).toHaveBeenCalledWith(
            'TTS command completed successfully',
            expect.objectContaining({
                userId: 'test-owner-id',
                guildId: 'test-guild-id',
                textLength: 11,
                voice: 'nova',
            }),
        );
    });

    it('should successfully join and speak', async () => {
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return null;} // Default to alloy
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(true); // join_user = true
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.joinVoiceChannel.mockResolvedValue(undefined);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockResolvedValue(undefined);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockVoiceService.joinVoiceChannel).toHaveBeenCalledWith(mockVoiceChannel);
        expect(mockVoiceService.speakText).toHaveBeenCalledWith('Hello world', 'test-guild-id', 'alloy');
        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '✅ Successfully spoke text using alloy voice.',
            ephemeral: true,
        });
    });

    it('should handle TTS error', async () => {
        const ttsError = new Error('TTS failed');
        mockInteraction.options.getString.mockImplementation((option: string) => {
            if (option === 'text') {return 'Hello world';}
            if (option === 'voice') {return 'alloy';}
            return null;
        });
        mockInteraction.options.getBoolean.mockReturnValue(false);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockRejectedValue(ttsError);

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Failed to speak text: TTS failed',
            ephemeral: true,
        });
        expect(mockContext.log.error).toHaveBeenCalledWith(
            'TTS command failed',
            expect.objectContaining({
                userId: 'test-owner-id',
                error: ttsError,
            }),
        );
    });

    it('should handle general errors', async () => {
        const generalError = new Error('General error');
        mockInteraction.options.getString.mockImplementation(() => {
            throw generalError;
        });

        await speakCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Error executing speak command',
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
});