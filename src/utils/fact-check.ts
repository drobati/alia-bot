import { BotLogger } from './logger';

const ENDPOINT = 'https://openrouter.ai/api/v1/systemone';
const DEFAULT_MODEL = 'typesafe/jev-1.13';
const TIMEOUT_MS = 8000;

/**
 * Below this, Alia says she is not certain rather than stating the answer plainly.
 *
 * Measured against the live model on eight claims with known truth values: true
 * claims scored 0.95-0.99 and false ones 0.01-0.30, including the commonly
 * misremembered 1997 Deep Blue result in both directions. 0.75 sits in that gap
 * with room on either side.
 */
export const FACT_CHECK_FLOOR = 0.75;

const INSTRUCTIONS = 'Is the answer factually accurate as a response to the question?';

export interface FactCheckDeps {
    fetch?: typeof fetch;
    apiKey?: string;
    model?: string;
    log?: BotLogger;
}

/**
 * Asks Jev how likely it is that an answer Alia just wrote is true.
 *
 * Returns the probability, or null whenever no judgement could be made — no key,
 * the kill switch, a transport failure, a malformed reply. Null means "unjudged",
 * never "wrong": the caller sends the original answer untouched, because a broken
 * fact-checker must not start hedging answers that are perfectly good.
 */
export async function checkAnswer(
    question: string,
    answer: string,
    deps: FactCheckDeps = {},
): Promise<number | null> {
    const log = deps.log;
    const apiKey = deps.apiKey ?? process.env.OPENROUTER_API_KEY;
    const model = deps.model ?? process.env.JEV_MODEL ?? DEFAULT_MODEL;

    // Same kill switch as the classifier, so one env change stops all Jev traffic.
    if (model === 'off') {
        return null;
    }
    if (!apiKey) {
        log?.error('Fact check has no OPENROUTER_API_KEY; not checking');
        return null;
    }
    // Nothing to judge, and the markers-only path can legitimately produce this.
    if (answer.trim().length === 0) {
        return null;
    }

    const doFetch = deps.fetch ?? fetch;
    const body = JSON.stringify({
        model,
        state: { question, answer },
        questions: { accurate: { type: 'noul', instructions: INSTRUCTIONS } },
    });

    try {
        const response = await doFetch(ENDPOINT, {
            method: 'POST',
            headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
            log?.error('Fact check request failed', { status: response.status, model });
            return null;
        }

        const json = await response.json() as { answers?: { accurate?: { noul?: unknown } } };
        const p = json?.answers?.accurate?.noul;
        if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
            log?.error('Fact check returned an unusable probability', { model });
            return null;
        }
        return p;
    } catch (error) {
        log?.error('Fact check threw', { error, model });
        return null;
    }
}
