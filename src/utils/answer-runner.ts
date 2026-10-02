import { Message } from 'discord.js';
import { TOOLS } from '../tools';
import { buildAnswerEmbed } from './answer-embed';
import { LogReason, recordClassification } from './classification-log';
import { checkRelevance, RELEVANCE_FLOOR } from './fact-check';
import { classify } from './question-classifier';
import { decide } from './question-router';
import { CONFIDENCE_FLOOR, Classification, ToolName } from './question-types';
import { Context } from './types';

/**
 * Tools that return the nearest search hit rather than a computed answer, so
 * their output can be on the subject without answering the question. Weather,
 * math, time and member lookups either answer exactly what was asked or return
 * null; they are not checked.
 */
const SEARCH_TOOLS: ReadonlySet<ToolName> = new Set<ToolName>(['wikipedia']);

export type AnswerOutcome =
    | { kind: 'answered' }
    /** Carries the classification so the caller can decide whether to fact-check what the LLM writes. */
    | { kind: 'llm'; classification: Classification | null }
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
    const fallback = (c: Classification | null): AnswerOutcome =>
        (addressedToBot ? { kind: 'llm', classification: c } : { kind: 'silent' });

    const classification = await classify(content, { addressedToBot }, { log: context.log });
    const route = decide(classification, addressedToBot);

    const log = async (reason: LogReason, routeLabel: string) => {
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
        // Only the actual rejection reason is logged. A confident non-tool type
        // (directed_at_human, compliment, the tool-less phase-2 types) is the
        // routine case and would bury the interesting rows if logged too.
        if (classification && classification.confidence < CONFIDENCE_FLOOR) {
            await log('below_floor', route.kind);
        }
        return fallback(classification);
    }

    try {
        const answer = await TOOLS[route.tool].run(content, { message, context });
        if (!answer) {
            // Routing was right and the tool had nothing. A different problem
            // from a bad classification, and recorded as one.
            await log('tool_no_answer', `tool:${route.tool}`);
            return fallback(classification);
        }

        if (SEARCH_TOOLS.has(route.tool)) {
            // "What's the largest mammal?" found the article "Mammal": accurate,
            // on the subject, and no answer at all. An off-topic hit is treated as
            // no hit, so an addressed question goes to the LLM (which is itself
            // fact-checked) and a passive one stays silent.
            const relevance = await checkRelevance(content, `${answer.title}: ${answer.body}`, {
                log: context.log,
            });
            if (relevance !== null && relevance < RELEVANCE_FLOOR) {
                context.log.info('Tool answer did not answer the question; falling back', {
                    tool: route.tool,
                    title: answer.title,
                    relevance,
                    addressed: addressedToBot,
                });
                await log('tool_off_topic', `tool:${route.tool}`);
                return fallback(classification);
            }
        }

        const payload = { embeds: [buildAnswerEmbed(answer)] };
        if (addressedToBot) {
            if (!message.channel.isSendable()) {
                return fallback(classification);
            }
            await message.channel.send(payload);
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
        return fallback(classification);
    }
}
