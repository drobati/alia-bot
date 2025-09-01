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

            // Use text as-is without any processing
            const processedText = text;

            log.info('TTS command initiated by owner', {
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: guild.id,
                textLength: text.length,
                voice: voice,
            });

            try {
                // Generate and play TTS
                await voiceService.speakText(processedText, guild.id, voice as any);

                await interaction.followUp({
                    content: `✅ Successfully spoke text using ${voice} voice.`,
                    ephemeral: true,
                });

                log.info('TTS command completed successfully', {
                    userId: interaction.user.id,
                    guildId: guild.id,
                    textLength: text.length,
                    voice: voice,
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