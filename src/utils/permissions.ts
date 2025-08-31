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
 * @throws Error if user is not the bot owner
 */
export async function checkOwnerPermission(interaction: any): Promise<void> {
    if (!isOwner(interaction.user.id)) {
        await interaction.reply({
            content: '❌ This command is restricted to the bot owner only.',
            ephemeral: true,
        });
        throw new Error('Unauthorized: User is not bot owner');
    }
}