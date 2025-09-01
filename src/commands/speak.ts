import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';
import { TTS_CONFIG } from '../utils/constants';
import { checkOwnerPermission } from '../utils/permissions';

const VOICE_OPTIONS = [
    { name: 'Alloy (Neutral)', value: 'alloy', keywords: ['neutral', 'default', 'balanced'] },
    { name: 'Echo (Male)', value: 'echo', keywords: ['male', 'masculine'] },
    { name: 'Fable (British Male)', value: 'fable', keywords: ['british', 'male', 'accent', 'uk'] },
    { name: 'Onyx (Deep Male)', value: 'onyx', keywords: ['deep', 'male', 'bass', 'low'] },
    { name: 'Nova (Female)', value: 'nova', keywords: ['female', 'feminine'] },
    { name: 'Shimmer (Soft Female)', value: 'shimmer', keywords: ['soft', 'female', 'gentle', 'quiet'] },
];

const TONE_OPTIONS = [
    { name: 'Neutral (Default)', value: 'neutral', keywords: ['normal', 'default', 'regular'] },
    { name: 'Happy/Excited', value: 'happy', keywords: ['excited', 'joyful', 'cheerful', 'upbeat'] },
    { name: 'Sad/Melancholy', value: 'sad', keywords: ['melancholy', 'somber', 'depressed', 'down'] },
    { name: 'Angry/Intense', value: 'angry', keywords: ['mad', 'furious', 'intense', 'rage'] },
    { name: 'Calm/Soothing', value: 'calm', keywords: ['peaceful', 'relaxed', 'zen', 'tranquil'] },
    { name: 'Mysterious/Dark', value: 'mysterious', keywords: ['dark', 'eerie', 'ominous', 'spooky'] },
    { name: 'Dramatic/Epic', value: 'dramatic', keywords: ['epic', 'theatrical', 'grand', 'powerful'] },
    { name: 'Sarcastic/Witty', value: 'sarcastic', keywords: ['witty', 'ironic', 'dry', 'clever'] },
];

/**
 * Apply emotional tone to text by adding contextual modifiers
 * Since OpenAI TTS doesn't have tone parameters, we modify the input text
 * to naturally influence the speech patterns and delivery
 */
function applyEmotionalTone(text: string, tone: string): string {
    if (tone === 'neutral') {
        return text;
    }

    const toneModifiers: Record<string, { prefix: string; suffix: string; textModifier?: (s: string) => string }> = {
        happy: {
            prefix: '[Speaking with joy and enthusiasm] ',
            suffix: ' [End with upbeat energy]',
            textModifier: text => {
                // Add exclamation if no punctuation, or convert existing punctuation to exclamation
                if (text.match(/[.!?]+$/)) {
                    return text.replace(/[.!?]+$/g, match => match.includes('!') ? match : '!');
                } else {
                    return text + '!';
                }
            },
        },
        sad: {
            prefix: '[Speaking with melancholy and somber tone] ',
            suffix: ' [End with quiet reflection]',
            textModifier: text => text.replace(/!/g, '.').toLowerCase(),
        },
        angry: {
            prefix: '[Speaking with intensity and force] ',
            suffix: ' [End with strong emphasis]',
            textModifier: text => text.toUpperCase().replace(/[.?]/g, '!'),
        },
        calm: {
            prefix: '[Speaking with peaceful, soothing tone] ',
            suffix: ' [End with gentle calmness]',
            textModifier: text => text.replace(/!/g, '.').replace(/[A-Z]/g, match => match.toLowerCase()),
        },
        mysterious: {
            prefix: '[Speaking with mysterious, dark undertones] ',
            suffix: ' [End with ominous pause]',
            textModifier: text => text.replace(/!/g, '...'),
        },
        dramatic: {
            prefix: '[Speaking with grand, theatrical presence] ',
            suffix: ' [End with dramatic flourish]',
            textModifier: text => text.replace(/\b(\w)/g, match => match.toUpperCase()),
        },
        sarcastic: {
            prefix: '[Speaking with dry wit and subtle irony] ',
            suffix: ' [End with knowing pause]',
            textModifier: text => `"${text}"`, // Add quotes to emphasize sarcasm
        },
    };

    const modifier = toneModifiers[tone];
    if (!modifier) {
        return text;
    }

    let processedText = text;
    if (modifier.textModifier) {
        processedText = modifier.textModifier(text);
    }

    return `${modifier.prefix}${processedText}${modifier.suffix}`;
}

export default {
    data: new SlashCommandBuilder()
        .setName('speak')
        .setDescription('Make the bot speak text in a voice channel (Owner only)')
        .addStringOption(option =>
            option
                .setName('text')
                .setDescription('The text to speak')
                .setRequired(true))
        .addStringOption(option =>
            option
                .setName('voice')
                .setDescription('Voice to use for TTS (type to search)')
                .setRequired(false)
                .setAutocomplete(true))
        .addStringOption(option =>
            option
                .setName('tone')
                .setDescription('Emotional tone for the speech (type to search)')
                .setRequired(false)
                .setAutocomplete(true))
        .addBooleanOption(option =>
            option
                .setName('join_user')
                .setDescription('Join your current voice channel first')
                .setRequired(false)),

    async autocomplete(interaction: any) {
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'voice') {
            const query = focusedOption.value.toLowerCase();

            let filtered = VOICE_OPTIONS.filter(voice =>
                // Match by name or keywords
                voice.name.toLowerCase().includes(query) ||
                voice.value.toLowerCase().includes(query) ||
                voice.keywords.some(keyword => keyword.includes(query)),
            );

            // Limit to 25 options (Discord's limit)
            filtered = filtered.slice(0, 25);

            await interaction.respond(
                filtered.map(voice => ({ name: voice.name, value: voice.value })),
            );
        }

        if (focusedOption.name === 'tone') {
            const query = focusedOption.value.toLowerCase();

            let filtered = TONE_OPTIONS.filter(tone =>
                // Match by name or keywords
                tone.name.toLowerCase().includes(query) ||
                tone.value.toLowerCase().includes(query) ||
                tone.keywords.some(keyword => keyword.includes(query)),
            );

            // Limit to 25 options (Discord's limit)
            filtered = filtered.slice(0, 25);

            await interaction.respond(
                filtered.map(tone => ({ name: tone.name, value: tone.value })),
            );
        }
    },

    async execute(interaction: any, context: Context) {
        const { log } = context;

        try {
            // Check if user is bot owner
            await checkOwnerPermission(interaction, context);

            // Get voice service from context
            if (!context.voiceService) {
                await interaction.reply({
                    content: '❌ Voice service not initialized. Please restart the bot.',
                    ephemeral: true,
                });
                return;
            }
            const voiceService = context.voiceService;

            const text = interaction.options.getString('text');
            const voice = interaction.options.getString('voice') || 'alloy';
            const tone = interaction.options.getString('tone') || 'neutral';
            const joinUser = interaction.options.getBoolean('join_user') || false;

            // Validate voice option
            const validVoices = VOICE_OPTIONS.map(v => v.value);
            if (!validVoices.includes(voice)) {
                await interaction.reply({
                    content: `❌ Invalid voice option. Valid voices are: ${validVoices.join(', ')}`,
                    ephemeral: true,
                });
                return;
            }

            // Validate tone option
            const validTones = TONE_OPTIONS.map(t => t.value);
            if (!validTones.includes(tone)) {
                await interaction.reply({
                    content: `❌ Invalid tone option. Valid tones are: ${validTones.join(', ')}`,
                    ephemeral: true,
                });
                return;
            }

            // Validate text length
            if (text.length > TTS_CONFIG.MAX_TEXT_LENGTH) {
                await interaction.reply({
                    content: `❌ Text is too long. Maximum length is ${TTS_CONFIG.MAX_TEXT_LENGTH} characters.`,
                    ephemeral: true,
                });
                return;
            }

            if (text.length < 1) {
                await interaction.reply({
                    content: '❌ Please provide some text to speak.',
                    ephemeral: true,
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            const guild = interaction.guild;
            const member = interaction.member;

            if (!guild || !member) {
                await interaction.followUp({
                    content: '❌ This command can only be used in a server.',
                    ephemeral: true,
                });
                return;
            }

            // Handle joining user's voice channel if requested
            if (joinUser) {
                const userVoiceChannel = voiceService.getUserVoiceChannel(member);
                if (!userVoiceChannel) {
                    await interaction.followUp({
                        content: '❌ You need to be in a voice channel for me to join you.',
                        ephemeral: true,
                    });
                    return;
                }

                try {
                    await voiceService.joinVoiceChannel(userVoiceChannel);
                    log.info('Joined user voice channel for TTS', {
                        userId: interaction.user.id,
                        channelId: userVoiceChannel.id,
                        channelName: userVoiceChannel.name,
                    });
                } catch (error) {
                    await interaction.followUp({
                        content: `❌ Failed to join voice channel: ${error instanceof Error ?
                            error.message : 'Unknown error'}`,
                        ephemeral: true,
                    });
                    return;
                }
            }

            // Check if bot is connected to a voice channel
            if (!voiceService.isConnectedToVoice(guild.id)) {
                await interaction.followUp({
                    content: '❌ Bot is not connected to any voice channel. ' +
                        'Use `/join` first or set `join_user` to true.',
                    ephemeral: true,
                });
                return;
            }

            // Process text with emotional tone
            const processedText = applyEmotionalTone(text, tone);

            log.info('TTS command initiated by owner', {
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: guild.id,
                textLength: text.length,
                processedTextLength: processedText.length,
                voice: voice,
                tone: tone,
            });

            try {
                // Generate and play TTS
                await voiceService.speakText(processedText, guild.id, voice as any);

                const toneDisplay = tone === 'neutral' ? '' : ` with ${tone} tone`;
                await interaction.followUp({
                    content: `✅ Successfully spoke text using ${voice} voice${toneDisplay}.`,
                    ephemeral: true,
                });

                log.info('TTS command completed successfully', {
                    userId: interaction.user.id,
                    guildId: guild.id,
                    textLength: text.length,
                    voice: voice,
                    tone: tone,
                });

            } catch (error) {
                await interaction.followUp({
                    content: `❌ Failed to speak text: ${error instanceof Error ? error.message : 'Unknown error'}`,
                    ephemeral: true,
                });

                log.error('TTS command failed', {
                    userId: interaction.user.id,
                    guildId: guild.id,
                    textLength: text.length,
                    voice: voice,
                    tone: tone,
                    error: error,
                });
            }

        } catch (error) {
            // Handle authorization errors
            if (error instanceof Error && error.message.startsWith('Unauthorized')) {
                log.warn('Unauthorized TTS command attempt', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    guildId: interaction.guild?.id,
                });
                // Error already sent to user by checkOwnerPermission
                return;
            }

            // Handle other errors
            log.error('Unexpected error in TTS command', {
                userId: interaction.user.id,
                error: error,
            });

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: '❌ An unexpected error occurred while processing your request.',
                    ephemeral: true,
                });
            } else {
                await interaction.followUp({
                    content: '❌ An unexpected error occurred while processing your request.',
                    ephemeral: true,
                });
            }
        }
    },
};