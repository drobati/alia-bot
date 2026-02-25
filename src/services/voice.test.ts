import { VoiceService } from './voice';
import { Context } from '../utils/types';
import * as fs from 'fs';
import * as os from 'os';
import * as crypto from 'crypto';

// Mock all external dependencies
jest.mock('@discordjs/voice', () => ({
    joinVoiceChannel: jest.fn(),
    createAudioPlayer: jest.fn(),
    createAudioResource: jest.fn(),
    entersState: jest.fn(),
    VoiceConnectionStatus: {
        Ready: 'ready',
        Disconnected: 'disconnected',
    },
    AudioPlayerStatus: {
        Idle: 'idle',
    },
}));

jest.mock('@elevenlabs/elevenlabs-js');
jest.mock('fs');
jest.mock('os');
jest.mock('crypto');

describe('VoiceService', () => {
    let voiceService: VoiceService;
    let mockContext: Context;
    let mockElevenLabs: any;
    let mockVoiceConnection: any;
    let mockChannel: any;
    let mockMember: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock environment
        process.env.ELEVENLABS_API_KEY = 'test-api-key';

        // Mock ElevenLabs
        const { ElevenLabsClient } = jest.requireMock('@elevenlabs/elevenlabs-js');
        mockElevenLabs = {
            textToSpeech: {
                convert: jest.fn(),
            },
        };
        ElevenLabsClient.mockImplementation(() => mockElevenLabs);

        // Mock voice connection
        mockVoiceConnection = {
            joinConfig: { channelId: 'test-channel-id' },
            destroy: jest.fn(),
            subscribe: jest.fn(),
            on: jest.fn(),
        };

        // Mock Discord voice channel
        mockChannel = {
            id: 'test-channel-id',
            name: 'Test Channel',
            type: 2, // GUILD_VOICE
            guild: {
                id: 'test-guild-id',
                voiceAdapterCreator: jest.fn(),
            },
        };

        // Mock Discord member
        mockMember = {
            voice: {
                channel: mockChannel,
            },
        };

        mockContext = {
            log: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
        } as any;

        // Mock @discordjs/voice functions
        const discordVoice = jest.requireMock('@discordjs/voice');
        discordVoice.joinVoiceChannel.mockReturnValue(mockVoiceConnection);
        discordVoice.entersState.mockResolvedValue(mockVoiceConnection);

        voiceService = new VoiceService(mockContext);
    });

    afterEach(() => {
        delete process.env.ELEVENLABS_API_KEY;
    });

    describe('constructor', () => {
        it('should create VoiceService successfully with API key', () => {
            expect(voiceService).toBeInstanceOf(VoiceService);
        });

        it('should throw error when ELEVENLABS_API_KEY is missing', () => {
            delete process.env.ELEVENLABS_API_KEY;
            expect(() => new VoiceService(mockContext)).toThrow(
                'ELEVENLABS_API_KEY environment variable is required for TTS functionality',
            );
        });

        it('should throw error when ELEVENLABS_API_KEY is empty', () => {
            process.env.ELEVENLABS_API_KEY = '';
            expect(() => new VoiceService(mockContext)).toThrow(
                'ELEVENLABS_API_KEY environment variable is required for TTS functionality',
            );
        });
    });

    describe('joinVoiceChannel', () => {
        it('should return existing connection if already connected', async () => {
            // Set up existing connection
            await voiceService.joinVoiceChannel(mockChannel);

            // Try to join again
            const result = await voiceService.joinVoiceChannel(mockChannel);

            expect(result).toBe(mockVoiceConnection);
            expect(mockContext.log.debug).toHaveBeenCalledWith(
                'Already connected to voice channel',
                expect.objectContaining({
                    guildId: 'test-guild-id',
                    channelId: 'test-channel-id',
                }),
            );
        });

        it('should successfully join new voice channel', async () => {
            const result = await voiceService.joinVoiceChannel(mockChannel);

            expect(result).toBe(mockVoiceConnection);
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Successfully joined voice channel',
                expect.objectContaining({
                    guildId: 'test-guild-id',
                    channelId: 'test-channel-id',
                    channelName: 'Test Channel',
                }),
            );
        });

        it('should handle join failure', async () => {
            const joinError = new Error('Join failed');
            const discordVoice = jest.requireMock('@discordjs/voice');
            discordVoice.entersState.mockRejectedValue(joinError);

            await expect(voiceService.joinVoiceChannel(mockChannel)).rejects.toThrow(
                'Failed to join voice channel: Join failed',
            );

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Failed to join voice channel',
                expect.objectContaining({
                    guildId: 'test-guild-id',
                    error: joinError,
                }),
            );
        });

        it('should set up disconnect handler', async () => {
            await voiceService.joinVoiceChannel(mockChannel);

            expect(mockVoiceConnection.on).toHaveBeenCalledWith(
                'disconnected',
                expect.any(Function),
            );
        });
    });

    describe('leaveVoiceChannel', () => {
        it('should successfully leave voice channel', async () => {
            // First join a channel
            await voiceService.joinVoiceChannel(mockChannel);

            // Then leave it
            await voiceService.leaveVoiceChannel('test-guild-id');

            expect(mockVoiceConnection.destroy).toHaveBeenCalled();
            expect(mockContext.log.info).toHaveBeenCalledWith('Left voice channel', {
                guildId: 'test-guild-id',
            });
        });

        it('should throw error when not connected', async () => {
            await expect(voiceService.leaveVoiceChannel('test-guild-id')).rejects.toThrow(
                'Not connected to any voice channel in this server',
            );
        });
    });

    describe('speakText', () => {
        beforeEach(async () => {
            // Set up voice connection first
            await voiceService.joinVoiceChannel(mockChannel);

            // Mock file system operations
            jest.spyOn(os, 'tmpdir').mockReturnValue('/tmp');
            jest.spyOn(crypto, 'randomUUID').mockReturnValue('12345678-1234-1234-1234-123456789012');

            const mockWriteStream = {
                write: jest.fn(),
                end: jest.fn(),
                on: jest.fn(),
            };
            jest.spyOn(fs, 'createWriteStream').mockReturnValue(mockWriteStream as any);
            jest.spyOn(fs, 'createReadStream').mockReturnValue({} as any);
            jest.spyOn(fs, 'unlinkSync').mockReturnValue(undefined);

            // Mock write stream events
            mockWriteStream.on.mockImplementation((event, callback) => {
                if (event === 'finish') {
                    setTimeout(callback, 0);
                }
            });

            // Mock ElevenLabs TTS response as a ReadableStream
            const mockAudioData = new Uint8Array(1024);
            const mockReadableStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(mockAudioData);
                    controller.close();
                },
            });
            mockElevenLabs.textToSpeech.convert.mockResolvedValue(mockReadableStream);

            // Mock audio player
            const discordVoice = jest.requireMock('@discordjs/voice');
            const mockPlayer = {
                play: jest.fn(),
                on: jest.fn(),
            };
            discordVoice.createAudioPlayer.mockReturnValue(mockPlayer);
            discordVoice.createAudioResource.mockReturnValue({});

            // Mock player events
            mockPlayer.on.mockImplementation((event, callback) => {
                if (event === 'idle') {
                    setTimeout(callback, 0);
                }
            });
        });

        it('should successfully speak text', async () => {
            const voiceId = '21m00Tcm4TlvDq8ikWAM';
            await voiceService.speakText('Hello world', 'test-guild-id', voiceId);

            expect(mockElevenLabs.textToSpeech.convert).toHaveBeenCalledWith(voiceId, {
                text: 'Hello world',
                modelId: 'eleven_v3',
                voiceSettings: {
                    stability: 0.0,
                    similarityBoost: 0.75,
                    style: 0.0,
                },
            });

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'TTS audio playback completed',
                expect.objectContaining({
                    guildId: 'test-guild-id',
                    textLength: 11,
                }),
            );
        });

        it('should truncate long text to max character limit', async () => {
            const longText = 'x'.repeat(5000);
            await voiceService.speakText(longText, 'test-guild-id', '21m00Tcm4TlvDq8ikWAM');

            expect(mockElevenLabs.textToSpeech.convert).toHaveBeenCalledWith(
                '21m00Tcm4TlvDq8ikWAM',
                expect.objectContaining({
                    text: 'x'.repeat(4096), // TTS_CONFIG.MAX_TEXT_LENGTH value
                }),
            );
        });

        it('should throw error when not connected', async () => {
            await expect(voiceService.speakText('Hello', 'other-guild-id', '21m00Tcm4TlvDq8ikWAM')).rejects.toThrow(
                'Bot is not connected to any voice channel in this server',
            );
        });

        it('should handle ElevenLabs API error', async () => {
            const apiError = new Error('API error');
            mockElevenLabs.textToSpeech.convert.mockRejectedValue(apiError);

            await expect(voiceService.speakText('Hello', 'test-guild-id', '21m00Tcm4TlvDq8ikWAM')).rejects.toThrow(
                'TTS failed: API error',
            );

            expect(mockContext.log.error).toHaveBeenCalledWith(
                'Failed to generate or play TTS audio',
                expect.objectContaining({
                    guildId: 'test-guild-id',
                    error: apiError,
                }),
            );
        });

        it('should clean up temporary file even on error', async () => {
            // Mock ElevenLabs to succeed first, then fail during playback
            const mockAudioData = new Uint8Array(1024);
            const mockStream = new ReadableStream({
                start(controller) {
                    controller.enqueue(mockAudioData);
                    controller.close();
                },
            });
            mockElevenLabs.textToSpeech.convert.mockResolvedValue(mockStream);

            // Mock player to fail
            const discordVoice = jest.requireMock('@discordjs/voice');
            const mockPlayer = {
                play: jest.fn(),
                on: jest.fn(),
            };
            discordVoice.createAudioPlayer.mockReturnValue(mockPlayer);

            // Mock player.on to immediately call error callback
            mockPlayer.on.mockImplementation((event, callback) => {
                if (event === 'error') {
                    setTimeout(() => callback(new Error('Playback failed')), 0);
                }
            });

            await expect(voiceService.speakText('Hello', 'test-guild-id', '21m00Tcm4TlvDq8ikWAM')).rejects.toThrow();

            expect(jest.spyOn(fs, 'unlinkSync')).toHaveBeenCalledWith(
                '/tmp/tts_12345678-1234-1234-1234-123456789012.mp3',
            );
        });

        it('should handle cleanup error gracefully', async () => {
            const cleanupError = new Error('Cleanup failed');
            jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
                throw cleanupError;
            });

            await voiceService.speakText('Hello', 'test-guild-id', '21m00Tcm4TlvDq8ikWAM');

            expect(mockContext.log.warn).toHaveBeenCalledWith(
                'Failed to clean up temporary TTS file',
                expect.objectContaining({
                    error: cleanupError,
                }),
            );
        });
    });

    describe('getUserVoiceChannel', () => {
        it('should return voice channel when user is in voice', () => {
            const result = voiceService.getUserVoiceChannel(mockMember);
            expect(result).toBe(mockChannel);
        });

        it('should return null when user is not in voice', () => {
            mockMember.voice.channel = null;
            const result = voiceService.getUserVoiceChannel(mockMember);
            expect(result).toBeNull();
        });

        it('should return null when channel is not voice type', () => {
            mockMember.voice.channel = { ...mockChannel, type: 0 }; // Not voice channel type
            const result = voiceService.getUserVoiceChannel(mockMember);
            expect(result).toBeNull();
        });
    });

    describe('isConnectedToVoice', () => {
        it('should return false when not connected', () => {
            const result = voiceService.isConnectedToVoice('test-guild-id');
            expect(result).toBe(false);
        });

        it('should return true when connected', async () => {
            await voiceService.joinVoiceChannel(mockChannel);
            const result = voiceService.isConnectedToVoice('test-guild-id');
            expect(result).toBe(true);
        });
    });

    describe('getConnectionInfo', () => {
        it('should return not connected when no connection', () => {
            const result = voiceService.getConnectionInfo('test-guild-id');
            expect(result).toEqual({ connected: false });
        });

        it('should return connection info when connected', async () => {
            await voiceService.joinVoiceChannel(mockChannel);
            const result = voiceService.getConnectionInfo('test-guild-id');
            expect(result).toEqual({
                connected: true,
                channelId: 'test-channel-id',
            });
        });
    });

    describe('resetIdleTimer', () => {
        it('should set an idle timer that auto-leaves after timeout', () => {
            jest.useFakeTimers();

            voiceService.resetIdleTimer('test-guild-id');

            // Timer should not have fired yet
            jest.advanceTimersByTime(4 * 60 * 1000); // 4 minutes
            expect(mockContext.log.info).not.toHaveBeenCalledWith(
                'Auto-leaving voice channel due to idle timeout',
                expect.anything(),
            );

            jest.useRealTimers();
        });

        it('should clear previous timer when reset', () => {
            jest.useFakeTimers();

            voiceService.resetIdleTimer('test-guild-id');
            voiceService.resetIdleTimer('test-guild-id'); // reset again

            // Should not have doubled up
            jest.advanceTimersByTime(5 * 60 * 1000 + 100);
            jest.useRealTimers();
        });
    });

    describe('clearIdleTimer', () => {
        it('should clear an existing idle timer', () => {
            jest.useFakeTimers();

            voiceService.resetIdleTimer('test-guild-id');
            voiceService.clearIdleTimer('test-guild-id');

            jest.advanceTimersByTime(6 * 60 * 1000);
            expect(mockContext.log.info).not.toHaveBeenCalledWith(
                'Auto-leaving voice channel due to idle timeout',
                expect.anything(),
            );

            jest.useRealTimers();
        });

        it('should handle clearing when no timer exists', () => {
            expect(() => voiceService.clearIdleTimer('no-timer-guild')).not.toThrow();
        });
    });

    describe('destroy', () => {
        it('should destroy all connections', async () => {
            await voiceService.joinVoiceChannel(mockChannel);

            voiceService.destroy();

            expect(mockVoiceConnection.destroy).toHaveBeenCalled();
            expect(mockContext.log.info).toHaveBeenCalledWith(
                'Destroyed voice connection during shutdown',
                { guildId: 'test-guild-id' },
            );
        });

        it('should handle destroy error gracefully', async () => {
            await voiceService.joinVoiceChannel(mockChannel);
            const destroyError = new Error('Destroy failed');
            mockVoiceConnection.destroy.mockImplementation(() => {
                throw destroyError;
            });

            voiceService.destroy();

            expect(mockContext.log.warn).toHaveBeenCalledWith(
                'Error destroying voice connection during shutdown',
                expect.objectContaining({
                    guildId: 'test-guild-id',
                    error: destroyError,
                }),
            );
        });
    });
});