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

jest.mock('openai');
jest.mock('fs');
jest.mock('os');
jest.mock('crypto');

describe('VoiceService', () => {
    let voiceService: VoiceService;
    let mockContext: Context;
    let mockOpenAI: any;
    let mockVoiceConnection: any;
    let mockChannel: any;
    let mockMember: any;

    beforeEach(() => {
        jest.clearAllMocks();

        // Mock environment
        process.env.OPENAI_API_KEY = 'test-api-key';

        // Mock OpenAI
        const OpenAI = jest.requireMock('openai');
        mockOpenAI = {
            audio: {
                speech: {
                    create: jest.fn(),
                },
            },
        };
        OpenAI.mockImplementation(() => mockOpenAI);

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
        delete process.env.OPENAI_API_KEY;
    });

    describe('constructor', () => {
        it('should create VoiceService successfully with API key', () => {
            expect(voiceService).toBeInstanceOf(VoiceService);
        });

        it('should throw error when OPENAI_API_KEY is missing', () => {
            delete process.env.OPENAI_API_KEY;
            expect(() => new VoiceService(mockContext)).toThrow(
                'OPENAI_API_KEY environment variable is required for TTS functionality',
            );
        });

        it('should throw error when OPENAI_API_KEY is empty', () => {
            process.env.OPENAI_API_KEY = '';
            expect(() => new VoiceService(mockContext)).toThrow(
                'OPENAI_API_KEY environment variable is required for TTS functionality',
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

            // Mock OpenAI TTS response
            const mockArrayBuffer = new ArrayBuffer(1024);
            mockOpenAI.audio.speech.create.mockResolvedValue({
                arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
            });

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
            await voiceService.speakText('Hello world', 'test-guild-id', 'alloy');

            expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith({
                model: 'tts-1',
                voice: 'alloy',
                input: 'Hello world',
                response_format: 'mp3',
            });

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'TTS audio playback completed',
                expect.objectContaining({
                    guildId: 'test-guild-id',
                    textLength: 11,
                }),
            );
        });

        it('should truncate long text to 4096 characters', async () => {
            const longText = 'x'.repeat(5000);
            await voiceService.speakText(longText, 'test-guild-id', 'alloy');

            expect(mockOpenAI.audio.speech.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    input: 'x'.repeat(4096),
                }),
            );
        });

        it('should throw error when not connected', async () => {
            await expect(voiceService.speakText('Hello', 'other-guild-id', 'alloy')).rejects.toThrow(
                'Bot is not connected to any voice channel in this server',
            );
        });

        it('should handle OpenAI API error', async () => {
            const apiError = new Error('API error');
            mockOpenAI.audio.speech.create.mockRejectedValue(apiError);

            await expect(voiceService.speakText('Hello', 'test-guild-id', 'alloy')).rejects.toThrow(
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
            // Mock OpenAI to succeed first, then fail during playback
            const mockArrayBuffer = new ArrayBuffer(1024);
            mockOpenAI.audio.speech.create.mockResolvedValue({
                arrayBuffer: jest.fn().mockResolvedValue(mockArrayBuffer),
            });

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

            await expect(voiceService.speakText('Hello', 'test-guild-id', 'alloy')).rejects.toThrow();

            expect(jest.spyOn(fs, 'unlinkSync')).toHaveBeenCalledWith(
                '/tmp/tts_12345678-1234-1234-1234-123456789012.mp3',
            );
        });

        it('should handle cleanup error gracefully', async () => {
            const cleanupError = new Error('Cleanup failed');
            jest.spyOn(fs, 'unlinkSync').mockImplementation(() => {
                throw cleanupError;
            });

            await voiceService.speakText('Hello', 'test-guild-id', 'alloy');

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