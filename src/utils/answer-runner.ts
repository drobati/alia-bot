import { Message } from 'discord.js';
import { TOOLS } from '../tools';
import { buildAnswerEmbed } from './answer-embed';
import { recordClassification } from './classification-log';
import { classify } from './question-classifier';
import { decide } from './question-router';
import { Context } from './types';

export type AnswerOutcome =
    | { kind: 'answered' }
    | { kind: 'llm' }
    | { kind: 'silent' };

/**
 * The shared engine behind both entry points. Classifies, routes, and sends the
 * embed when a tool answers. `llm` means the caller should run the existing
 * assistant path; `silent` means say nothing.
 */
export async function answerQuestion(
    message: Message,
    context: Context,
    opts: { content: string; addressedToBot: boolean },
): Promise<AnswerOutcome> {
    const { addressedToBot, content } = opts;
    const fallback: AnswerOutcome = addressedToBot ? { kind: 'llm' } : { kind: 'silent' };

    const classification = await classify(content, { addressedToBot }, { log: context.log });
    const route = decide(classification, addressedToBot);

    const log = async (reason: 'below_floor' | 'tool_no_answer', routeLabel: string) => {
        if (!classification || !message.guildId) {
            return;
        }
        await recordClassification(context, {
            guildId: message.guildId,
            channelId: message.channelId,
            messageId: message.id,
            content,
            addressed: addressedToBot,
            classification,
            route: routeLabel,
            reason,
        });
    };

    if (route.kind !== 'tool') {
        await log('below_floor', route.kind);
        return fallback;
    }

    try {
        const answer = await TOOLS[route.tool].run(content, { message, context });
        if (!answer) {
            // Routing was right and the tool had nothing. A different problem
            // from a bad classification, and recorded as one.
            await log('tool_no_answer', `tool:${route.tool}`);
            return fallback;
        }

        const payload = { embeds: [buildAnswerEmbed(answer)] };
        if (addressedToBot) {
            // eslint-disable-next-line no-unused-vars
            const channel = message.channel as { send?: (p: unknown) => Promise<unknown> };
            if (typeof channel?.send !== 'function') {
                return fallback;
            }
            await channel.send(payload);
        } else {
            // A passive answer replies, so it is obvious which message it answers
            // in a channel where nobody addressed her.
            await message.reply(payload);
        }

        context.log.info('Answered with a tool', {
            tool: route.tool,
            type: classification?.type,
            addressed: addressedToBot,
        });
        return { kind: 'answered' };
    } catch (error) {
        context.log.error('Tool answer failed', { tool: route.tool, error });
        return fallback;
    }
}
