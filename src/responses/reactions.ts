import { Message, GuildEmoji } from 'discord.js';
import { Context } from '../types';

// Contextual keyword → emoji mappings
// Each entry: [pattern, unicode emoji to use if no custom emoji matches]
const KEYWORD_REACTIONS: [RegExp, string][] = [
    [/\blol\b|lmao|lmfao|😂|🤣/i, '😂'],
    [/\bfire\b|🔥/i, '🔥'],
    [/\blove\b|❤️|💕/i, '❤️'],
    [/\bnice\b|👍/i, '👍'],
    [/\bwow\b|😮/i, '😮'],
    [/\bsad\b|😢|😭/i, '😢'],
    [/\bgg\b/i, '🫡'],
    [/\bthank(?:s| you)\b/i, '💜'],
    [/\bcongrat(?:s|ulations)?\b/i, '🎉'],
    [/\brip\b/i, '🪦'],
    [/\bpog\b|pogchamp/i, '😲'],
    [/\bcool\b|awesome|amazing|incredible/i, '✨'],
    [/\bscar(?:y|ed)\b|spooky|creepy/i, '😱'],
    [/\bhungry\b|food|pizza|taco|burger/i, '🍕'],
    [/\bcoffee\b|☕/i, '☕'],
    [/\brage\b|angry|furious/i, '😤'],
    [/\bsleep(?:y|ing)?\b|tired|exhausted/i, '😴'],
];

// Secret tag that always triggers a random reaction
const SECRET_TAG = /\bkwisatz haderach\b/i;

// All unicode emoji used in keyword reactions, for picking a random one
const ALL_EMOJI = KEYWORD_REACTIONS.map(([, emoji]) => emoji);

// Chance to react to any given message (5%)
const REACTION_CHANCE = 0.05;

// Cooldown: max one reaction per channel per this many ms
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// LOUDS regex (same as louds.ts) — skip these messages entirely
const LOUDS_REGEX = /^\s*([A-Z"][A-Z0-9 .,'"()?!&%$#@+-]+)$/;

// Cooldown tracking per channel
const channelCooldowns = new Map<string, number>();

/**
 * Try to find a custom server emoji whose name matches a keyword contextually.
 * Returns the emoji if found, null otherwise.
 */
function findContextualCustomEmoji(
    content: string,
    emojis: GuildEmoji[],
): GuildEmoji | null {
    const lowerContent = content.toLowerCase();
    // Look for custom emojis whose name appears as a word in the message
    const matches = emojis.filter(e => {
        const name = e.name?.toLowerCase();
        if (!name) {
            return false;
        }
        // Match emoji name as a substring in the message content
        return lowerContent.includes(name);
    });
    if (matches.length > 0) {
        return matches[Math.floor(Math.random() * matches.length)];
    }
    return null;
}

/**
 * Find a unicode emoji reaction based on keyword matching.
 */
function findKeywordReaction(content: string): string | null {
    for (const [pattern, emoji] of KEYWORD_REACTIONS) {
        if (pattern.test(content)) {
            return emoji;
        }
    }
    return null;
}

/**
 * Reactions response handler — occasionally reacts to messages with
 * contextual emoji. Runs independently of the priority response chain.
 */
export default async function reactions(
    message: Message,
    context: Context,
): Promise<void> {
    const { log } = context;

    try {
        // Skip messages without a guild (DMs)
        if (!message.guild) {
            return;
        }

        // Secret tag — always react with a random emoji, bypass all checks
        const isSecretTag = SECRET_TAG.test(message.content);
        if (isSecretTag) {
            const emoji = ALL_EMOJI[Math.floor(Math.random() * ALL_EMOJI.length)];
            await message.react(emoji);
            log.debug('Reaction added (secret tag)', {
                channelId: message.channelId,
                messageId: message.id,
                emoji,
            });
            return;
        }

        // Skip LOUDS — those are handled by the LOUDS response
        if (LOUDS_REGEX.test(message.content)) {
            return;
        }

        // Skip very short messages (less than 3 chars, e.g. "ok")
        if (message.content.trim().length < 3) {
            return;
        }

        // Roll the dice — only react to ~5% of messages
        if (Math.random() > REACTION_CHANCE) {
            return;
        }

        // Check channel cooldown
        const now = Date.now();
        const lastReaction = channelCooldowns.get(message.channelId) || 0;
        if (now - lastReaction < COOLDOWN_MS) {
            return;
        }

        // Get available custom emojis (filter out unavailable/Nitro-locked ones)
        const customEmojis = message.guild.emojis.cache.filter(
            e => e.available,
        );
        const emojiArray = [...customEmojis.values()];

        // Try contextual custom emoji first
        const customMatch = findContextualCustomEmoji(
            message.content,
            emojiArray,
        );
        if (customMatch) {
            await message.react(customMatch);
            channelCooldowns.set(message.channelId, now);
            log.debug('Reaction added (custom emoji)', {
                channelId: message.channelId,
                messageId: message.id,
                emoji: customMatch.name,
            });
            return;
        }

        // Try keyword-based unicode emoji
        const keywordMatch = findKeywordReaction(message.content);
        if (keywordMatch) {
            await message.react(keywordMatch);
            channelCooldowns.set(message.channelId, now);
            log.debug('Reaction added (keyword)', {
                channelId: message.channelId,
                messageId: message.id,
                emoji: keywordMatch,
            });
            return;
        }

        // No contextual match — don't react with something random
    } catch (error) {
        // Silently fail — reactions are non-critical
        log.debug('Reaction failed', { error });
    }
}

// Exports for testing
export {
    KEYWORD_REACTIONS,
    REACTION_CHANCE,
    COOLDOWN_MS,
    LOUDS_REGEX,
    SECRET_TAG,
    ALL_EMOJI,
    findContextualCustomEmoji,
    findKeywordReaction,
};

// Reset cooldowns (for testing)
export function resetCooldowns(): void {
    channelCooldowns.clear();
}
