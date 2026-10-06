import OpenAI from 'openai';
import { BotLogger } from './logger';

/**
 * A bare, deterministic completion — no mood, no memories, no personality.
 *
 * `utils/assistant.ts` builds Alia's voice; this is for the small mechanical
 * asks around a tool answer, where the only thing wanted is a short literal
 * string. Temperature is 0 because these calls must be repeatable: naming the
 * article that answers a question is a lookup, not a performance.
 */
const DEFAULT_MODEL = 'x-ai/grok-4.3';

/* eslint-disable no-unused-vars */
export interface CompleteDeps {
    client?: { chat: { completions: { create: (args: unknown) => Promise<unknown> } } };
    model?: string;
    log?: BotLogger;
}
/* eslint-enable no-unused-vars */

let shared: OpenAI | null = null;
function sharedClient(): OpenAI {
    if (!shared) {
        shared = new OpenAI({
            baseURL: 'https://openrouter.ai/api/v1',
            apiKey: process.env.OPENROUTER_API_KEY || 'test-key-for-ci',
        });
    }
    return shared;
}

/**
 * Returns the model's text, or null on any failure. Null means "no answer",
 * never "the answer is empty": every caller treats it as a reason to fall back
 * rather than to send something.
 */
export async function complete(
    prompt: string,
    maxTokens: number,
    deps: CompleteDeps = {},
): Promise<string | null> {
    const model = deps.model ?? process.env.ASSISTANT_MODEL ?? DEFAULT_MODEL;
    if (!process.env.OPENROUTER_API_KEY && !deps.client) {
        deps.log?.error('No OPENROUTER_API_KEY; cannot complete');
        return null;
    }

    try {
        const client = deps.client ?? sharedClient();
        const completion = await client.chat.completions.create({
            model,
            messages: [{ role: 'user', content: prompt }],
            max_tokens: maxTokens,
            temperature: 0,
        }) as { choices?: { message?: { content?: string } }[] };

        const text = completion?.choices?.[0]?.message?.content;
        if (typeof text !== 'string') {
            deps.log?.error('Completion returned no text', { model });
            return null;
        }
        const trimmed = text.trim();
        return trimmed.length > 0 ? trimmed : null;
    } catch (error) {
        deps.log?.error('Completion failed', { error, model });
        return null;
    }
}
