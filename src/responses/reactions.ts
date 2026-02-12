import { Message, GuildEmoji } from 'discord.js';
import { Context } from '../types';

// Prefixes that indicate reaction-appropriate emoji (not game icons)
const REACTION_PREFIXES = [
    'yes_', 'no_', 'hype_', 'roast_', 'stfu_',
    'vibe_', 'meh_', 'misc_',
];

// Game-specific prefixes to exclude
const GAME_PREFIXES = ['dota2_', 'poe_', 'wow_', 'arc_'];

// Secret tag that always triggers a random reaction
const SECRET_TAG = /\bkwisatz haderach\b/i;

// Chance to react to any given message (5%)
const REACTION_CHANCE = 0.05;

// Cooldown: max one reaction per channel per this many ms
const COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes

// LOUDS regex (same as louds.ts) — skip these messages entirely
const LOUDS_REGEX = /^\s*([A-Z"][A-Z0-9 .,'"()?!&%$#@+-]+)$/;

// Cooldown tracking per channel
const channelCooldowns = new Map<string, number>();

/**
 * Filter emoji to only reaction-appropriate ones.
 * Includes: emoji with reaction prefixes (yes_, no_, hype_, etc.)
 * and unprefixed emoji (no underscore = custom one-offs like SatisfiedBob).
 * Excludes: game-specific emoji (dota2_, poe_, wow_, arc_).
 */
function filterReactionEmoji(emojis: GuildEmoji[]): GuildEmoji[] {
    return emojis.filter(e => {
        const name = e.name?.toLowerCase();
        if (!name) {
            return false;
        }

        // Exclude game-specific emoji
        if (GAME_PREFIXES.some(prefix => name.startsWith(prefix))) {
            return false;
        }

        // Include emoji with reaction prefixes
        if (REACTION_PREFIXES.some(prefix => name.startsWith(prefix))) {
            return true;
        }

        // Include unprefixed emoji (no underscore = custom one-offs)
        if (!name.includes('_')) {
            return true;
        }

        return false;
    });
}

/**
 * Reactions response handler — occasionally reacts to messages with
 * a random server emoji. Runs independently of the priority response chain.
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

        // Get available custom emojis (filter out unavailable/Nitro-locked ones)
        const customEmojis = message.guild.emojis.cache.filter(
            e => e.available,
        );
        const reactionEmoji = filterReactionEmoji([...customEmojis.values()]);

        // Secret tag — always react with a random emoji, bypass all checks
        if (SECRET_TAG.test(message.content)) {
            if (reactionEmoji.length > 0) {
                const emoji = reactionEmoji[Math.floor(Math.random() * reactionEmoji.length)];
                await message.react(emoji);
                log.debug('Reaction added (secret tag)', {
                    channelId: message.channelId,
                    messageId: message.id,
                    emoji: emoji.name,
                });
            }
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

        // No reaction emoji available — nothing to do
        if (reactionEmoji.length === 0) {
            return;
        }

        // Pick a random reaction emoji
        const emoji = reactionEmoji[Math.floor(Math.random() * reactionEmoji.length)];
        await message.react(emoji);
        channelCooldowns.set(message.channelId, now);
        log.debug('Reaction added', {
            channelId: message.channelId,
            messageId: message.id,
            emoji: emoji.name,
        });
    } catch (error) {
        // Silently fail — reactions are non-critical
        log.debug('Reaction failed', { error });
    }
}

// Exports for testing
export {
    REACTION_PREFIXES,
    GAME_PREFIXES,
    REACTION_CHANCE,
    COOLDOWN_MS,
    LOUDS_REGEX,
    SECRET_TAG,
    filterReactionEmoji,
};

// Reset cooldowns (for testing)
export function resetCooldowns(): void {
    channelCooldowns.clear();
}
