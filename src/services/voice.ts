import {
    VoiceConnection,
    createAudioPlayer,
    createAudioResource,
    joinVoiceChannel,
    AudioPlayerStatus,
    VoiceConnectionStatus,
    entersState,
} from '@discordjs/voice';
import { VoiceChannel, GuildMember } from 'discord.js';
import { Context } from '../utils/types';
import OpenAI from 'openai';
import { createWriteStream, createReadStream, unlinkSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';
import { randomUUID } from 'crypto';

export class VoiceService {
    private connections = new Map<string, VoiceConnection>();
    private openai: OpenAI;
    private context: Context;

    constructor(context: Context) {
        this.context = context;

        if (!process.env.OPENAI_API_KEY) {
            throw new Error('OPENAI_API_KEY environment variable is required for TTS functionality');
        }

        this.openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY,
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
        const connection = this.connections.get(guildId);
        if (!connection) {
            throw new Error('Not connected to any voice channel in this server');
        }

        connection.destroy();
        this.connections.delete(guildId);

        this.context.log.info('Left voice channel', { guildId });
    }

    async speakText(
        text: string,
        guildId: string,
        voice: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer' = 'alloy',
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

            // Generate TTS audio using OpenAI
            const mp3Response = await this.openai.audio.speech.create({
                model: 'tts-1',
                voice: voice,
                input: text.substring(0, 4096), // OpenAI TTS has a 4096 character limit
                response_format: 'mp3',
            });

            // Save audio to temporary file
            const tempDir = tmpdir();
            const fileName = `tts_${randomUUID()}.mp3`;
            tempFilePath = join(tempDir, fileName);

            const buffer = Buffer.from(await mp3Response.arrayBuffer());
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

            // Create audio resource and play
            const resource = createAudioResource(createReadStream(tempFilePath));
            const player = createAudioPlayer();

            player.play(resource);
            connection.subscribe(player);

            // Wait for audio to finish playing
            await new Promise<void>((resolve, reject) => {
                const timeout = setTimeout(() => {
                    reject(new Error('Audio playback timeout'));
                }, 30_000); // 30 second timeout

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
        if (!voiceState.channel || voiceState.channel.type !== 2) { // 2 = GUILD_VOICE
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