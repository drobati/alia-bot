import config from 'config';

/**
 * Check if a user ID matches the configured bot owner
 */
export function isOwner(userId: string): boolean {
    const ownerId = config.get<string>('owner');
    return userId === ownerId;
}

/**
 * Check owner permission and reply with error if unauthorized
 * @param interaction Discord interaction object
 * @param context Context object for logging (optional)
 * @throws Error if user is not the bot owner
 */
export async function checkOwnerPermission(interaction: any, context?: any): Promise<void> {
    const ownerId = config.get<string>('owner');
    const userId = interaction.user.id;
    const isUserOwner = userId === ownerId;

    // Enhanced logging for debugging
    const logData = {
        command: interaction.commandName,
        userId: userId,
        username: interaction.user.username,
        userIdType: typeof userId,
        configuredOwnerId: ownerId,
        ownerIdType: typeof ownerId,
        isOwner: isUserOwner,
        exactMatch: userId === ownerId,
        comparison: `"${userId}" === "${ownerId}"`,
    };

    if (context?.log) {
        context.log.info('=== OWNER PERMISSION CHECK ===', logData);
    }

    if (!isUserOwner) {
        await interaction.reply({
            content: `❌ This command is restricted to the bot owner only.\n` +
                    `**Debug Info:**\n` +
                    `Your ID: \`${userId}\`\n` +
                    `Owner ID: \`${ownerId}\`\n` +
                    `Match: ${isUserOwner ? '✅' : '❌'}`,
            ephemeral: true,
        });
        throw new Error('Unauthorized: User is not bot owner');
    }
}