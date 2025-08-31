import { SlashCommandBuilder } from 'discord.js';
import leaveCommand from './leave';
import { Context } from '../utils/types';
import config from 'config';

// Mock config
jest.mock('config');
const mockConfig = config as jest.Mocked<typeof config>;

describe('leave command', () => {
    let mockInteraction: any;
    let mockContext: Context;
    let mockVoiceService: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockVoiceService = {
            isConnectedToVoice: jest.fn(),
            leaveVoiceChannel: jest.fn(),
        };

        mockInteraction = {
            user: { id: 'test-owner-id' },
            guild: { id: 'test-guild-id' },
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
        expect(leaveCommand.data).toBeInstanceOf(SlashCommandBuilder);
        expect(leaveCommand.data.name).toBe('leave');
        expect(leaveCommand.data.description).toContain('Owner only');
    });

    it('should reject non-owner users', async () => {
        mockInteraction.user.id = 'not-owner';

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ This command is restricted to the bot owner only.',
            ephemeral: true,
        });
    });

    it('should handle missing voice service', async () => {
        mockContext.voiceService = undefined;

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Voice service not initialized. Please restart the bot.',
            ephemeral: true,
        });
    });

    it('should handle missing guild', async () => {
        mockInteraction.guild = null;

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ This command can only be used in a server.',
            ephemeral: true,
        });
    });

    it('should handle not connected to voice', async () => {
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.reply).toHaveBeenCalledWith({
            content: '❌ Not connected to any voice channel.',
            ephemeral: true,
        });
    });

    it('should successfully leave voice channel', async () => {
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.leaveVoiceChannel.mockResolvedValue(undefined);

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        expect(mockVoiceService.leaveVoiceChannel).toHaveBeenCalledWith('test-guild-id');
        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '✅ Successfully left the voice channel.',
            ephemeral: true,
        });
        expect(mockContext.log.info).toHaveBeenCalledWith(
            'Bot left voice channel via command',
            expect.objectContaining({
                userId: 'test-owner-id',
                guildId: 'test-guild-id',
            }),
        );
    });

    it('should handle voice leave error', async () => {
        const leaveError = new Error('Failed to leave');
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.leaveVoiceChannel.mockRejectedValue(leaveError);

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ Failed to leave voice channel: Failed to leave',
            ephemeral: true,
        });
        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Failed to leave voice channel via command',
            expect.objectContaining({
                userId: 'test-owner-id',
                error: leaveError,
            }),
        );
    });

    it('should handle general errors', async () => {
        const generalError = new Error('General error');
        mockVoiceService.isConnectedToVoice.mockImplementation(() => {
            throw generalError;
        });

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockContext.log.error).toHaveBeenCalledWith(
            'Error executing leave command',
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
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockInteraction.deferReply.mockImplementation(() => {
            mockInteraction.deferred = true;
            throw generalError;
        });

        await leaveCommand.execute(mockInteraction, mockContext);

        expect(mockInteraction.followUp).toHaveBeenCalledWith({
            content: '❌ An error occurred: Deferred error',
            ephemeral: true,
        });
    });
});