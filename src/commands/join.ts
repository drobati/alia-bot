import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';
import { checkOwnerPermission } from '../utils/permissions';

export default {
    data: new SlashCommandBuilder()
        .setName('join')
        .setDescription('Make the bot join your voice channel (Owner only)'),

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

            const guild = interaction.guild;
            const member = interaction.member;

            if (!guild || !member) {
                await interaction.reply({
                    content: '❌ This command can only be used in a server.',
                    ephemeral: true,
                });
                return;
            }

            // Check if bot is already connected
            if (voiceService.isConnectedToVoice(guild.id)) {
                await interaction.reply({
                    content: `✅ Already connected to a voice channel.`,
                    ephemeral: true,
                });
                return;
            }

            // Get user's voice channel
            const userVoiceChannel = voiceService.getUserVoiceChannel(member);
            if (!userVoiceChannel) {
                await interaction.reply({
                    content: '❌ You need to be in a voice channel for me to join you.',
                    ephemeral: true,
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                await voiceService.joinVoiceChannel(userVoiceChannel);

                await interaction.followUp({
                    content: `✅ Successfully joined **${userVoiceChannel.name}**`,
                    ephemeral: true,
                });

                log.logCommand({
                    command: 'join',
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    guildId: guild.id,
                    channelId: userVoiceChannel.id,
                    success: true,
                });

            } catch (error) {
                await interaction.followUp({
                    content: `❌ Failed to join voice channel: ${error instanceof Error ?
                        error.message : 'Unknown error'}`,
                    ephemeral: true,
                });

                log.logCommand({
                    command: 'join',
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    guildId: guild.id,
                    channelId: userVoiceChannel.id,
                    success: false,
                    error: error instanceof Error ? error : new Error(String(error)),
                });
            }

        } catch (error) {
            // Handle authorization errors
            if (error instanceof Error && error.message.startsWith('Unauthorized')) {
                log.warn('Unauthorized join command attempt', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                return; // Reply already sent in checkOwnerPermission
            }

            log.error('Error executing join command', {
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