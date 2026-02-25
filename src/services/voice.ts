import {
    VoiceConnection,
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
} from '@discordjs/voice';
import { VoiceChannel, GuildMember, ChannelType } from 'discord.js';
import { Context } from '../utils/types';
import { TTS_CONFIG } from '../utils/constants';
import { ElevenLabsClient } from '@elevenlabs/elevenlabs-js';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export class VoiceService {
    private connections = new Map<string, VoiceConnection>();
    private idleTimers = new Map<string, NodeJS.Timeout>();
    private elevenlabs: ElevenLabsClient;
    private context: Context;
    private static IDLE_TIMEOUT_MS = 5 * 60 * 1000; // 5 minutes

    constructor(context: Context) {
        this.context = context;

        if (!process.env.ELEVENLABS_API_KEY) {
            throw new Error('ELEVENLABS_API_KEY environment variable is required for TTS functionality');
        }

        this.elevenlabs = new ElevenLabsClient({
            apiKey: process.env.ELEVENLABS_API_KEY,
        });
    }

    async joinVoiceChannel(channel: VoiceChannel): Promise<VoiceConnection> {
        const existingConnection = this.connections.get(channel.guild.id);
        if (existingConnection) {
            this.context.log.debug('Already connected to voice channel', {
                guildId: channel.guild.id,
                channelId: channel.id,
            });
            return existingConnection;
        }

        try {
            const connection = joinVoiceChannel({
                channelId: channel.id,
                guildId: channel.guild.id,
                adapterCreator: channel.guild.voiceAdapterCreator,
            });

            // Wait for connection to be ready
            await entersState(connection, VoiceConnectionStatus.Ready, 20_000);

            this.connections.set(channel.guild.id, connection);

            // Set up cleanup on disconnect
            connection.on(VoiceConnectionStatus.Disconnected, () => {
                this.connections.delete(channel.guild.id);
                this.context.log.info('Voice connection disconnected', {
                    guildId: channel.guild.id,
                    channelId: channel.id,
                });
            });

            this.context.log.info('Successfully joined voice channel', {
                guildId: channel.guild.id,
                channelId: channel.id,
                channelName: channel.name,
            });

            return connection;
        } catch (error) {
            this.context.log.error('Failed to join voice channel', {
                guildId: channel.guild.id,
                channelId: channel.id,
                error: error,
            });
            throw new Error(`Failed to join voice channel: ${
                error instanceof Error ? error.message : 'Unknown error'
            }`);
        }
    }

    async leaveVoiceChannel(guildId: string): Promise<void> {
        this.clearIdleTimer(guildId);
        const connection = this.connections.get(guildId);
        if (!connection) {
            throw new Error('Not connected to any voice channel in this server');
        }

        connection.destroy();
        this.connections.delete(guildId);

        this.context.log.info('Left voice channel', { guildId });
    }

    resetIdleTimer(guildId: string): void {
        const existingTimer = this.idleTimers.get(guildId);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        const timer = setTimeout(async () => {
            this.idleTimers.delete(guildId);
            if (this.isConnectedToVoice(guildId)) {
                this.context.log.info('Auto-leaving voice channel due to idle timeout', { guildId });
                try {
                    await this.leaveVoiceChannel(guildId);
                } catch (error) {
                    this.context.log.error('Failed to auto-leave voice channel', { guildId, error });
                }
            }
        }, VoiceService.IDLE_TIMEOUT_MS);

        this.idleTimers.set(guildId, timer);
    }

    clearIdleTimer(guildId: string): void {
        const timer = this.idleTimers.get(guildId);
        if (timer) {
            clearTimeout(timer);
            this.idleTimers.delete(guildId);
        }
    }

    async speakText(
        text: string,
        guildId: string,
        voice: string = 'Df0A8fHl2LOO7kDNIlpg',
    ): Promise<void> {
        const connection = this.connections.get(guildId);
        if (!connection) {
            throw new Error('Bot is not connected to any voice channel in this server');
        }

        let tempFilePath: string | null = null;

        try {
            this.context.log.info('Generating TTS audio', {
                guildId,
                textLength: text.length,
                voice,
            });

            // Generate TTS audio using ElevenLabs
            const audioStream = await this.elevenlabs.textToSpeech.convert(voice, {
                text: text.substring(0, TTS_CONFIG.MAX_TEXT_LENGTH),
                modelId: 'eleven_turbo_v2_5',
            });

            // Save audio to temporary file
            const tempDir = tmpdir();
            const fileName = `tts_${randomUUID()}.mp3`;
            tempFilePath = join(tempDir, fileName);

            // Convert ReadableStream to buffer
            const response = new Response(audioStream);
            const arrayBuffer = await response.arrayBuffer();
            const buffer = Buffer.from(arrayBuffer);

            const writeStream = createWriteStream(tempFilePath);
            writeStream.write(buffer);
            writeStream.end();

            // Wait for file write to complete
            await new Promise<void>((resolve, reject) => {
                writeStream.on('finish', resolve);
                writeStream.on('error', reject);
            });

            this.context.log.debug('TTS audio file created', {
                guildId,
                filePath: tempFilePath,
                fileSize: buffer.length,
            });

            // Subscribe player first, then brief delay so Discord audio
            // stream is established before playback begins
            const resource = createAudioResource(createReadStream(tempFilePath));
            const player = createAudioPlayer();

            connection.subscribe(player);
            await new Promise(resolve => setTimeout(resolve, 200));
            player.play(resource);

            // Wait for audio to finish playing
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Audio playback timeout'));
                }, TTS_CONFIG.PLAYBACK_TIMEOUT_MS); // 30 second timeout

                player.on(AudioPlayerStatus.Idle, () => {
                    clearTimeout(timeout);
                    resolve();
                });

                player.on('error', error => {
                    clearTimeout(timeout);
                    reject(error);
                });
            });

            this.context.log.info('TTS audio playback completed', {
                guildId,
                textLength: text.length,
            });

        } catch (error) {
            this.context.log.error('Failed to generate or play TTS audio', {
                guildId,
                textLength: text.length,
                voice,
                error: error,
            });
            throw new Error(`TTS failed: ${
                error instanceof Error ? error.message : 'Unknown error'
            }`);
        } finally {
            // Clean up temporary file
            if (tempFilePath) {
                try {
                    unlinkSync(tempFilePath);
                    this.context.log.debug('Cleaned up temporary TTS file', { filePath: tempFilePath });
                } catch (cleanupError) {
                    this.context.log.warn('Failed to clean up temporary TTS file', {
                        filePath: tempFilePath,
                        error: cleanupError,
                    });
                }
            }
        }
    }

    getUserVoiceChannel(member: GuildMember): VoiceChannel | null {
        const voiceState = member.voice;
        if (!voiceState.channel || voiceState.channel.type !== ChannelType.GuildVoice) {
            return null;
        }
        return voiceState.channel as VoiceChannel;
    }

    isConnectedToVoice(guildId: string): boolean {
        return this.connections.has(guildId);
    }

    getConnectionInfo(guildId: string): { connected: boolean; channelId?: string; channelName?: string } {
        const connection = this.connections.get(guildId);
        if (!connection) {
            return { connected: false };
        }

        // Get channel info from the connection
        return {
            connected: true,
            channelId: connection.joinConfig.channelId || undefined,
        };
    }

    // Cleanup all connections on bot shutdown
    destroy(): void {
        for (const [, timer] of this.idleTimers) {
            clearTimeout(timer);
        }
        this.idleTimers.clear();

        for (const [guildId, connection] of this.connections) {
            try {
                connection.destroy();
                this.context.log.info('Destroyed voice connection during shutdown', { guildId });
            } catch (error) {
                this.context.log.warn('Error destroying voice connection during shutdown', {
                    guildId,
                    error: error,
                });
            }
        }
        this.connections.clear();
    }
}