import { SlashCommandBuilder } from 'discord.js';
import joinCommand from './join';
import { Context } from '../utils/types';
import config from 'config';

// Mock config
jest.mock('config');
const mockConfig = config as jest.Mocked<typeof config>;

describe('join command', () => {
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
        };

        mockInteraction = {
            user: { id: 'test-owner-id' },
            guild: { id: 'test-guild-id' },
            member: mockMember,
            reply: jest.fn(),
            deferReply: jest.fn(),
            followUp: jest.fn(),
            deferred: false,
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
        expect(joinCommand.data).toBeInstanceOf(SlashCommandBuilder);
        expect(joinCommand.data.name).toBe('join');
        expect(joinCommand.data.description).toContain('Owner only');
    });

    it('should reject non-owner users', async () => {
        mockInteraction.user.id = 'not-owner';

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: `❌ This command is restricted to the bot owner only.\n` +
                    `**Debug Info:**\n` +
                    `Your ID: \`not-owner\`\n` +
                    `Owner ID: \`test-owner-id\`\n` +
                    `Match: ❌`,
            ephemeral: true,
        });
    });

    it('should handle missing voice service', async () => {
        mockContext.voiceService = undefined;

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Voice service not initialized. Please restart the bot.',
            ephemeral: true,
        });
    });

    it('should handle missing guild', async () => {
        mockInteraction.guild = null;

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ This command can only be used in a server.',
            ephemeral: true,
        });
    });

    it('should handle missing member', async () => {
        mockInteraction.member = null;

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ This command can only be used in a server.',
            ephemeral: true,
        });
    });

    it('should handle already connected bot', async () => {
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '✅ Already connected to a voice channel.',
            ephemeral: true,
        });
    });

    it('should handle user not in voice channel', async () => {
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);
        mockVoiceService.getUserVoiceChannel.mockReturnValue(null);

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ You need to be in a voice channel for me to join you.',
            ephemeral: true,
        });
    });

    it('should successfully join voice channel', async () => {
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.joinVoiceChannel.mockResolvedValue(undefined);

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockVoiceService.joinVoiceChannel).toHaveBeenCalledWith(mockVoiceChannel);
        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '✅ Successfully joined **Test Voice Channel**',
            ephemeral: true,
        });
        expect(mockContext.log.info).toHaveBeenCalledWith(
            'Bot joined voice channel via command',
            expect.objectContaining({
                userId: 'test-owner-id',
                guildId: 'test-guild-id',
                channelId: 'test-voice-channel',
                channelName: 'Test Voice Channel',
            }),
        );
    });

    it('should handle voice join error', async () => {
        const joinError = new Error('Failed to join');
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.joinVoiceChannel.mockRejectedValue(joinError);

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Failed to join voice channel: Failed to join',
            ephemeral: true,
        });
        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Failed to join voice channel via command',
            expect.objectContaining({
                userId: 'test-owner-id',
                error: joinError,
            }),
        );
    });

    it('should handle general errors', async () => {
        const generalError = new Error('General error');
        mockVoiceService.isConnectedToVoice.mockImplementation(() => {
            throw generalError;
        });

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Error executing join command',
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

    it('should handle errors after defer', async () => {
        const generalError = new Error('Deferred error');
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockInteraction.deferReply.mockImplementation(() => {
            mockInteraction.deferred = true;
            throw generalError;
        });

        await joinCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ An error occurred: Deferred error',
            ephemeral: true,
        });
    });
});