import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../utils/types';
import { checkOwnerPermission } from '../utils/permissions';

export default {
    data: new SlashCommandBuilder()
        .setName('leave')
        .setDescription('Make the bot leave the voice channel (Owner only)'),

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

            const guild = interaction.guild;

            if (!guild) {
                await interaction.reply({
                    content: '❌ This command can only be used in a server.',
                    ephemeral: true,
                });
                return;
            }

            // Check if bot is connected to a voice channel
            if (!voiceService.isConnectedToVoice(guild.id)) {
                await interaction.reply({
                    content: '❌ Not connected to any voice channel.',
                    ephemeral: true,
                });
                return;
            }

            await interaction.deferReply({ ephemeral: true });

            try {
                await voiceService.leaveVoiceChannel(guild.id);

                await interaction.followUp({
                    content: '✅ Successfully left the voice channel.',
                    ephemeral: true,
                });

                log.info('Bot left voice channel via command', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                    guildId: guild.id,
                });

            } catch (error) {
                await interaction.followUp({
                    content: `❌ Failed to leave voice channel: ${error instanceof Error ?
                        error.message : 'Unknown error'}`,
                    ephemeral: true,
                });

                log.error('Failed to leave voice channel via command', {
                    userId: interaction.user.id,
                    guildId: guild.id,
                    error: error,
                });
            }

        } catch (error) {
            // Handle authorization errors
            if (error instanceof Error && error.message.startsWith('Unauthorized')) {
                log.warn('Unauthorized leave command attempt', {
                    userId: interaction.user.id,
                    username: interaction.user.username,
                });
                return; // Reply already sent in checkOwnerPermission
            }

            log.error('Error executing leave command', {
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