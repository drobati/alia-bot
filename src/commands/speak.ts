import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';
import { TTS_CONFIG } from '../utils/constants';
import { checkOwnerPermission } from '../utils/permissions';

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
                .setDescription('Voice to use for TTS')
                .setRequired(false)
                .addChoices(
                    { name: 'Alloy (Neutral)', value: 'alloy' },
                    { name: 'Echo (Male)', value: 'echo' },
                    { name: 'Fable (British Male)', value: 'fable' },
                    { name: 'Onyx (Deep Male)', value: 'onyx' },
                    { name: 'Nova (Female)', value: 'nova' },
                    { name: 'Shimmer (Soft Female)', value: 'shimmer' },
                ))
        .addBooleanOption(option =>
            option
                .setName('join_user')
                .setDescription('Join your current voice channel first')
                .setRequired(false)),

    async execute(interaction: any, context: Context) {
        const { log } = context;

        try {
            // Check if user is bot owner
            await checkOwnerPermission(interaction);

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

            log.info('TTS command initiated by owner', {
                userId: interaction.user.id,
                username: interaction.user.username,
                guildId: guild.id,
                textLength: text.length,
                voice: voice,
            });

            try {
                // Generate and play TTS
                await voiceService.speakText(text, guild.id, voice as any);

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
                });
                return; // Reply already sent in checkOwnerPermission
            }

            log.error('Error executing speak command', {
                userId: interaction.user.id,
                error: error,
            });

            const errorMessage = error instanceof Error ? error.message : 'Unknown error occurred';

            if (interaction.deferred) {
                await interaction.followUp({
                    content: `❌ An error occurred: ${errorMessage}`,
                    ephemeral: true,
                });
            } else {
                await interaction.reply({
                    content: `❌ An error occurred: ${errorMessage}`,
                    ephemeral: true,
                });
            }
        }
    },
};