import { Message } from 'discord.js';
import { answerQuestion } from '../utils/answer-runner';
import { isPassiveChannel } from '../utils/passive-channels';
import { Context } from '../utils/types';

/** Trailing punctuation containing a question mark: `?`, `?!`, `!?`, `???`. */
export const QUESTION_SUFFIX = /[?!]*\?[?!]*\s*$/;
export const MIN_PASSIVE_LENGTH = 8;
export const PASSIVE_COOLDOWN_MS = 5 * 60 * 1000;

const cooldowns = new Map<string, number>();

export function resetQuestionCooldowns(): void {
    cooldowns.clear();
}

function onCooldown(channelId: string, now: number): boolean {
    const last = cooldowns.get(channelId);
    if (last !== undefined && now - last < PASSIVE_COOLDOWN_MS) {
        return true;
    }
    // Bounded: drop entries that have expired rather than keeping one per channel forever.
    for (const [id, at] of cooldowns) {
        if (now - at >= PASSIVE_COOLDOWN_MS) {
            cooldowns.delete(id);
        }
    }
    return false;
}

/**
 * Answers questions asked without mentioning Alia, in channels an administrator
 * opted in. Gates run cheapest first so a busy channel nobody opted in costs
 * nothing: Jev is the last thing reached.
 */
export default async (message: Message, context: Context): Promise<boolean> => {
    if (message.author.bot || !message.guildId) {
        return false;
    }

    const content = message.content.trim();
    if (!QUESTION_SUFFIX.test(content) || content.length < MIN_PASSIVE_LENGTH) {
        return false;
    }

    if (!(await isPassiveChannel(context, message.guildId, message.channelId))) {
        return false;
    }

    const now = Date.now();
    if (onCooldown(message.channelId, now)) {
        return false;
    }

    try {
        const outcome = await answerQuestion(message, context, { content, addressedToBot: false });
        if (outcome.kind === 'answered') {
            // Only a real answer starts the cooldown; silence should not mute the channel.
            cooldowns.set(message.channelId, now);
            return true;
        }
        return false;
    } catch (error) {
        context.log.error('Passive question handling failed', { error, messageId: message.id });
        return false;
    }
};
