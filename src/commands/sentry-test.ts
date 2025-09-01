import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Context } from '../utils/types';
import { Sentry } from '../lib/sentry';
import { checkOwnerPermission } from '../utils/permissions';

export const data = new SlashCommandBuilder()
    .setName('sentry-test')
    .setDescription('Test Sentry connectivity and logging (Owner only)');

export async function execute(interaction: ChatInputCommandInteraction, context: Context) {
    const { log } = context;

    try {
        // Check if user is owner
        await checkOwnerPermission(interaction, context);

        await interaction.deferReply({ ephemeral: true });

        // Test various Sentry features
        log.info('=== MANUAL SENTRY TEST INITIATED ===');

        // Test 1: Send a test message
        const messageId = Sentry.captureMessage('Manual Sentry test - captureMessage', 'info');

        // Test 2: Send a test exception
        const exceptionId = Sentry.captureException(new Error('Manual Sentry test - captureException'));

        // Test 3: Add a breadcrumb
        Sentry.addBreadcrumb({
            message: 'Manual Sentry test breadcrumb',
            level: 'info',
            category: 'test',
            data: {
                userId: interaction.user.id,
                username: interaction.user.username,
                testType: 'manual',
            },
        });

        // Test 4: Test our logger integration
        log.info('Manual Sentry test - logger integration', {
            userId: interaction.user.id,
            username: interaction.user.username,
            testType: 'manual_logger_test',
        });

        log.warn('Manual Sentry test - warning level', {
            testWarning: true,
        });

        await interaction.followUp({
            content: `🧪 **Sentry Test Results**\n` +
                    `**Message ID:** ${messageId || 'None'}\n` +
                    `**Exception ID:** ${exceptionId || 'None'}\n` +
                    `**Logger Test:** Sent via Bunyan → Sentry stream\n` +
                    `**Breadcrumb:** Added test breadcrumb\n\n` +
                    `Check Sentry dashboard for events. If IDs are null, DSN may be invalid.`,
            ephemeral: true,
        });

        log.info('Manual Sentry test completed', {
            userId: interaction.user.id,
            messageId,
            exceptionId,
            testResults: {
                messageIdExists: !!messageId,
                exceptionIdExists: !!exceptionId,
            },
        });

    } catch (error) {
        await interaction.followUp({
            content: `❌ Sentry test failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
            ephemeral: true,
        });

        log.error('Manual Sentry test failed', {
            userId: interaction.user.id,
            error,
        });
    }
}