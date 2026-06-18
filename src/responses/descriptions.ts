import { Message } from 'discord.js';
import { Context } from '../types';

// Matches a message that opens with a user mention followed by "is", e.g.
// "@user is cute". Group 1 = user id, group 2 = the description.
const DESCRIPTION_REGEX = /^\s*<@!?(\d+)>\s+is\s+(.+)$/i;

// Descriptions longer than this are ignored (the model column is STRING(255);
// 200 keeps a safety margin and mirrors the mercy-bot behaviour).
const MAX_DESCRIPTION_LENGTH = 200;

/**
 * Parses a "@user is <something>" message into a subject and description, or
 * null if it isn't one. Requires a real user mention (a plain name like
 * "bones is cute" is ignored), and skips questions and overly long text.
 */
export function parseDescription(
    message: Message,
): { userId: string; description: string } | null {
    if (message.author.bot || !message.inGuild()) {
        return null;
    }

    const match = message.content.match(DESCRIPTION_REGEX);
    if (!match) {
        return null;
    }

    const [, userId, rawDescription] = match;
    if (!message.mentions.users.has(userId)) {
        return null;
    }

    const description = rawDescription.trim().replace(/\.\s*$/, '');
    if (!description || description.endsWith('?') || description.length > MAX_DESCRIPTION_LENGTH) {
        return null;
    }

    return { userId, description };
}

/**
 * Natural-language capture for descriptions. When someone types
 * "@user is <something>" the description is stored (shared with the /is
 * command) and the message is acknowledged with a 📝 reaction.
 *
 * Returns true if the message was a description and was handled.
 */
export default async (message: Message, context: Context): Promise<boolean> => {
    const { tables, log } = context;

    try {
        const parsed = parseDescription(message);
        if (!parsed || !message.guildId) {
            return false;
        }

        // Skip if this exact description already exists for the user (the model
        // has a unique index, but checking first avoids noisy duplicate errors).
        const existing = await tables.UserDescriptions.findOne({
            where: {
                guild_id: message.guildId,
                user_id: parsed.userId,
                description: parsed.description,
            },
        });

        if (!existing) {
            await tables.UserDescriptions.create({
                guild_id: message.guildId,
                user_id: parsed.userId,
                description: parsed.description,
                creator_id: message.author.id,
            });
        }

        // Acknowledge with a reaction rather than a chat reply, so capture stays
        // quiet. Failures (missing perms, deleted message) are non-fatal.
        await message.react('📝').catch(() => {});

        log.debug('Description captured from message', {
            messageId: message.id,
            userId: parsed.userId,
            creatorId: message.author.id,
            duplicate: Boolean(existing),
        });

        return true;
    } catch (error) {
        log.error('Descriptions response failed:', { error });
        return false;
    }
};

// Export for testing
export { DESCRIPTION_REGEX, MAX_DESCRIPTION_LENGTH };
