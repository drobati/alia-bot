import { Message } from 'discord.js';
import { Context } from '../utils/types';
import { isOwner } from '../utils/permissions';
import { TTS_CONFIG } from '../utils/constants';

const DEFAULT_VOICE_ID = 'Df0A8fHl2LOO7kDNIlpg';

export default async function ttsChannel(message: Message, context: Context): Promise<boolean> {
    const guildId = message.guildId;
    if (!guildId) {
        return false;
    }

    // Only process owner messages
    if (!isOwner(message.author.id)) {
        return false;
    }

    // Check if this channel is the configured TTS channel
    const ttsChannelConfig = await context.tables.Config.findOne({
        where: { key: `tts_channel_${guildId}` },
    });

    if (!ttsChannelConfig?.value || ttsChannelConfig.value !== message.channelId) {
        return false;
    }

    const voiceService = context.voiceService;
    if (!voiceService) {
        context.log.warn('TTS channel message received but voice service not initialized');
        return false;
    }

    const member = message.member;
    if (!member) {
        return false;
    }

    const userVoiceChannel = voiceService.getUserVoiceChannel(member);
    if (!userVoiceChannel) {
        try {
            await message.react('\u274C');
        } catch { /* ignore */ }
        return true;
    }

    const text = message.content;
    if (!text || text.length === 0) {
        return false;
    }

    if (text.length > TTS_CONFIG.MAX_TEXT_LENGTH) {
        try {
            await message.react('\u2702\uFE0F');
        } catch { /* ignore */ }
        return true;
    }

    try {
        // Auto-join if not already connected
        if (!voiceService.isConnectedToVoice(guildId)) {
            await voiceService.joinVoiceChannel(userVoiceChannel);
            context.log.info('Auto-joined voice channel for TTS', {
                guildId,
                channelId: userVoiceChannel.id,
                channelName: userVoiceChannel.name,
            });
        }

        // Get configured default voice and stability
        const [voiceConfig, stabilityConfig] = await Promise.all([
            context.tables.Config.findOne({ where: { key: 'tts_default_voice' } }),
            context.tables.Config.findOne({ where: { key: 'tts_stability' } }),
        ]);
        const voice = voiceConfig?.value || DEFAULT_VOICE_ID;
        const stability = parseFloat(stabilityConfig?.value || '0.0');

        await voiceService.speakText(text, guildId, voice, stability);
        voiceService.resetIdleTimer(guildId);

        try {
            await message.react('\uD83D\uDD0A');
        } catch { /* ignore */ }

        context.log.info('TTS channel message spoken', {
            userId: message.author.id,
            guildId,
            textLength: text.length,
        });

        return true;
    } catch (error) {
        context.log.error('TTS channel handler failed', {
            error,
            userId: message.author.id,
            guildId,
        });
        try {
            await message.react('\u26A0\uFE0F');
        } catch { /* ignore */ }
        return true;
    }
}
