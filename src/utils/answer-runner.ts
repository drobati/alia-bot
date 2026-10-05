import { Message } from 'discord.js';
import { TOOLS } from '../tools';
import { buildAnswerEmbed } from './answer-embed';
import { LogReason, recordClassification } from './classification-log';
import {
    checkContradiction, checkRelevance, CONTRADICTION_CEILING, RELEVANCE_FLOOR,
} from './fact-check';
import { resolveAnswerEntity, writeSourcedAnswer } from './sourced-answer';
import { fetchArticle } from '../tools/wikipedia';
import { ToolAnswer } from '../tools/types';
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
/**
 * Names the thing that answers the question and fetches its article.
 *
 * Returns null unless the new article actually answers — the entity guess is
 * checked by the same relevance gate that rejected the first hit, so a bad guess
 * cannot sneak past on the second attempt.
 */
async function articleForAnswerEntity(
    question: string,
    rejectedTitle: string,
    context: Context,
): Promise<ToolAnswer | null> {
    const entity = await resolveAnswerEntity(question, { log: context.log });
    // Naming the article we just rejected means there is nothing new to try.
    if (!entity || entity.toLowerCase() === rejectedTitle.toLowerCase()) {
        return null;
    }

    const article = await fetchArticle(entity);
    if (!article) {
        return null;
    }

    const relevance = await checkRelevance(question, `${article.title}: ${article.body}`, {
        log: context.log,
    });
    return relevance !== null && relevance < RELEVANCE_FLOOR ? null : article;
}

/**
 * Replaces the article's lead paragraph with a sentence that answers the question.
 *
 * The extract contains the answer but rarely leads with it, so the reader has to
 * hunt for the number. The link stays attached either way.
 *
 * Degrades rather than fails: if the rewrite cannot be written, or the source
 * contradicts it, the verified extract is sent instead. A suspect sentence is
 * worse than a paragraph that was already judged to answer the question.
 */
async function statedAnswer(
    question: string,
    article: ToolAnswer,
    context: Context,
): Promise<ToolAnswer> {
    const written = await writeSourcedAnswer(question, article.title, article.body, {
        log: context.log,
    });
    if (!written) {
        return article;
    }

    const contradiction = await checkContradiction(question, written, article.body, {
        log: context.log,
    });
    if (contradiction !== null && contradiction >= CONTRADICTION_CEILING) {
        context.log.warn('Written answer contradicted its own source; sending the extract', {
            title: article.title,
            contradiction,
        });
        return article;
    }

    return { ...article, body: written };
}

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

        let article = answer;

        if (SEARCH_TOOLS.has(route.tool)) {
            // "What's the largest mammal?" found the article "Mammal": accurate,
            // on the subject, and no answer at all.
            const relevance = await checkRelevance(content, `${article.title}: ${article.body}`, {
                log: context.log,
            });

            if (relevance !== null && relevance < RELEVANCE_FLOOR) {
                // Searching the subject cannot find an answer that is a different
                // thing from the subject: "mammal" never ranks "Blue whale", and
                // "France" ranks "Capital punishment in France" above Paris. So ask
                // what the answer is, then look that up directly.
                const viaEntity = await articleForAnswerEntity(content, article.title, context);
                if (!viaEntity) {
                    context.log.info('Tool answer did not answer the question; falling back', {
                        tool: route.tool, title: article.title, relevance, addressed: addressedToBot,
                    });
                    await log('tool_off_topic', `tool:${route.tool}`);
                    return fallback(classification);
                }
                context.log.info('Resolved the answer entity after an off-topic hit', {
                    rejected: article.title, resolved: viaEntity.title,
                });
                article = viaEntity;
            }

            article = await statedAnswer(content, article, context);
        }

        const payload = { embeds: [buildAnswerEmbed(article)] };
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
