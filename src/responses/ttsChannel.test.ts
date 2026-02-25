import ttsChannel from './ttsChannel';

import config from 'config';

jest.mock('config');
const mockConfig = config as jest.Mocked<typeof config>;

describe('ttsChannel handler', () => {
    let mockMessage: any;
    let mockContext: any;
    let mockVoiceService: any;
    let mockVoiceChannel: any;
    let mockConfigFindOne: jest.Mock;

    beforeEach(() => {
        jest.clearAllMocks();

        mockConfig.get.mockImplementation((key: string) => {
            if (key === 'owner') {return 'test-owner-id';}
            return undefined;
        });

        mockVoiceChannel = {
            id: 'test-voice-channel',
            name: 'General Voice',
        };

        mockVoiceService = {
            getUserVoiceChannel: jest.fn(),
            isConnectedToVoice: jest.fn(),
            joinVoiceChannel: jest.fn(),
            speakText: jest.fn(),
            resetIdleTimer: jest.fn(),
        };

        mockConfigFindOne = jest.fn();

        mockMessage = {
            author: { id: 'test-owner-id', bot: false },
            guildId: 'test-guild-id',
            channelId: 'tts-channel-id',
            content: 'Hello world',
            member: {
                voice: { channel: mockVoiceChannel },
            },
            react: jest.fn(),
        };

        mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
                debug: jest.fn(),
            },
            voiceService: mockVoiceService,
            tables: {
                Config: {
                    findOne: mockConfigFindOne,
                },
            },
        };
    });

    it('should return false for non-guild messages', async () => {
        mockMessage.guildId = null;
        const result = await ttsChannel(mockMessage, mockContext);
        expect(result).toBe(false);
    });

    it('should return false for non-owner messages', async () => {
        mockMessage.author.id = 'not-owner';
        const result = await ttsChannel(mockMessage, mockContext);
        expect(result).toBe(false);
    });

    it('should return false when no TTS channel is configured', async () => {
        mockConfigFindOne.mockResolvedValue(null);
        const result = await ttsChannel(mockMessage, mockContext);
        expect(result).toBe(false);
    });

    it('should return false when message is in a different channel', async () => {
        mockConfigFindOne.mockResolvedValue({
            value: 'other-channel-id',
        });
        const result = await ttsChannel(mockMessage, mockContext);
        expect(result).toBe(false);
    });

    it('should react with X when owner is not in a voice channel', async () => {
        mockConfigFindOne.mockResolvedValue({
            value: 'tts-channel-id',
        });
        mockVoiceService.getUserVoiceChannel.mockReturnValue(null);

        const result = await ttsChannel(mockMessage, mockContext);

        expect(result).toBe(true);
        expect(mockMessage.react).toHaveBeenCalledWith('\u274C');
        expect(mockVoiceService.speakText).not.toHaveBeenCalled();
    });

    it('should return false for empty messages', async () => {
        mockMessage.content = '';
        mockConfigFindOne.mockResolvedValue({
            value: 'tts-channel-id',
        });
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);

        const result = await ttsChannel(mockMessage, mockContext);
        expect(result).toBe(false);
    });

    it('should react with scissors for messages exceeding max length', async () => {
        mockMessage.content = 'x'.repeat(5000);
        mockConfigFindOne.mockResolvedValue({
            value: 'tts-channel-id',
        });
        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);

        const result = await ttsChannel(mockMessage, mockContext);

        expect(result).toBe(true);
        expect(mockMessage.react).toHaveBeenCalledWith('\u2702\uFE0F');
    });

    it('should auto-join, speak, and reset idle timer', async () => {
        // First findOne for tts_channel config
        mockConfigFindOne
            .mockResolvedValueOnce({ value: 'tts-channel-id' })
            .mockResolvedValueOnce({ value: 'Df0A8fHl2LOO7kDNIlpg' }); // voice config

        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.isConnectedToVoice.mockReturnValue(false);
        mockVoiceService.joinVoiceChannel.mockResolvedValue(undefined);
        mockVoiceService.speakText.mockResolvedValue(undefined);

        const result = await ttsChannel(mockMessage, mockContext);

        expect(result).toBe(true);
        expect(mockVoiceService.joinVoiceChannel).toHaveBeenCalledWith(mockVoiceChannel);
        expect(mockVoiceService.speakText).toHaveBeenCalledWith(
            'Hello world',
            'test-guild-id',
            'Df0A8fHl2LOO7kDNIlpg',
        );
        expect(mockVoiceService.resetIdleTimer).toHaveBeenCalledWith('test-guild-id');
        expect(mockMessage.react).toHaveBeenCalledWith('\uD83D\uDD0A');
    });

    it('should reuse existing voice connection', async () => {
        mockConfigFindOne
            .mockResolvedValueOnce({ value: 'tts-channel-id' })
            .mockResolvedValueOnce(null); // no voice config, use default

        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true); // already connected

        mockVoiceService.speakText.mockResolvedValue(undefined);

        const result = await ttsChannel(mockMessage, mockContext);

        expect(result).toBe(true);
        expect(mockVoiceService.joinVoiceChannel).not.toHaveBeenCalled();
        expect(mockVoiceService.speakText).toHaveBeenCalled();
    });

    it('should use default voice when none configured', async () => {
        mockConfigFindOne
            .mockResolvedValueOnce({ value: 'tts-channel-id' })
            .mockResolvedValueOnce(null); // no voice config

        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockResolvedValue(undefined);

        await ttsChannel(mockMessage, mockContext);

        expect(mockVoiceService.speakText).toHaveBeenCalledWith(
            'Hello world',
            'test-guild-id',
            'Df0A8fHl2LOO7kDNIlpg',
        );
    });

    it('should react with warning on error', async () => {
        mockConfigFindOne
            .mockResolvedValueOnce({ value: 'tts-channel-id' })
            .mockResolvedValueOnce(null);

        mockVoiceService.getUserVoiceChannel.mockReturnValue(mockVoiceChannel);
        mockVoiceService.isConnectedToVoice.mockReturnValue(true);
        mockVoiceService.speakText.mockRejectedValue(new Error('TTS failed'));

        const result = await ttsChannel(mockMessage, mockContext);

        expect(result).toBe(true);
        expect(mockMessage.react).toHaveBeenCalledWith('\u26A0\uFE0F');
        expect(mockContext.log.error).toHaveBeenCalledWith(
            'TTS channel handler failed',
            expect.objectContaining({ guildId: 'test-guild-id' }),
        );
    });

    it('should return false when voice service is not initialized', async () => {
        mockContext.voiceService = undefined;
        mockConfigFindOne.mockResolvedValue({
            value: 'tts-channel-id',
        });

        const result = await ttsChannel(mockMessage, mockContext);
        expect(result).toBe(false);
    });
});
