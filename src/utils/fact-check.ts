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

/**
 * Below this, a tool's answer is treated as no answer at all.
 *
 * NOT YET MEASURED against the live model; it borrows FACT_CHECK_FLOOR's value
 * because the question has the same shape (a noul over question + text). It
 * exists because accuracy and relevance come apart: asked "What's the largest
 * mammal?", Wikipedia search returned the article "Mammal", whose summary is
 * entirely accurate and answers nothing. Calibrate it the way the fact-check
 * floor was — off-topic summaries against on-topic ones — and move it into the gap.
 */
export const RELEVANCE_FLOOR = 0.75;

/**
 * Above this, the source contradicts the answer and it is not sent.
 *
 * Framed as contradiction rather than support on purpose. Asking "is this
 * supported by the source" penalises anything derived — a metric-to-imperial
 * conversion scored 0.83 and a correct blue whale answer 0.73, which would have
 * hedged perfectly good answers. Asking "does the source contradict this"
 * isolates actual error: measured 0.02-0.03 for correct answers and 0.86-0.99
 * for wrong ones.
 */
export const CONTRADICTION_CEILING = 0.5;

const ACCURATE_INSTRUCTIONS = 'Is the answer factually accurate as a response to the question?';
const RELEVANT_INSTRUCTIONS =
    'Does the answer directly state the specific thing the question asks for? '
    + 'Text that is merely about the same topic, without containing the answer, does not count.';

const CONTRADICTS_INSTRUCTIONS =
    'Does the source contradict the answer? Say yes only if the source states something '
    + 'incompatible with it. Unit conversions, rounding and rephrasing are not contradictions.';

export interface FactCheckDeps {
    fetch?: typeof fetch;
    apiKey?: string;
    model?: string;
    log?: BotLogger;
}

/**
 * One noul judgement from Jev over a question and an answer. Returns null
 * whenever no judgement could be made — no key, the kill switch, a transport
 * failure, a malformed reply. Null means "unjudged", never "no".
 */
async function judge(
    key: string,
    instructions: string,
    question: string,
    answer: string,
    deps: FactCheckDeps,
    extraState: Record<string, string> = {},
): Promise<number | null> {
    const log = deps.log;
    const apiKey = deps.apiKey ?? process.env.OPENROUTER_API_KEY;
    const model = deps.model ?? process.env.JEV_MODEL ?? DEFAULT_MODEL;

    // Same kill switch as the classifier, so one env change stops all Jev traffic.
    if (model === 'off') {
        return null;
    }
    if (!apiKey) {
        log?.error('Fact check has no OPENROUTER_API_KEY; not checking', { check: key });
        return null;
    }
    // Nothing to judge, and the markers-only path can legitimately produce this.
    if (answer.trim().length === 0) {
        return null;
    }

    const doFetch = deps.fetch ?? fetch;
    const body = JSON.stringify({
        model,
        state: { question, answer, ...extraState },
        questions: { [key]: { type: 'noul', instructions } },
    });

    try {
        const response = await doFetch(ENDPOINT, {
            method: 'POST',
            headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
            log?.error('Fact check request failed', { status: response.status, model, check: key });
            return null;
        }

        const json = await response.json() as { answers?: Record<string, { noul?: unknown } | undefined> };
        const p = json?.answers?.[key]?.noul;
        if (typeof p !== 'number' || !Number.isFinite(p) || p < 0 || p > 1) {
            log?.error('Fact check returned an unusable probability', { model, check: key });
            return null;
        }
        return p;
    } catch (error) {
        log?.error('Fact check threw', { error, model, check: key });
        return null;
    }
}

/**
 * Asks Jev how likely it is that an answer Alia just wrote is true.
 *
 * Null means "unjudged", never "wrong": the caller sends the original answer
 * untouched, because a broken fact-checker must not start hedging answers that
 * are perfectly good.
 */
export async function checkAnswer(
    question: string,
    answer: string,
    deps: FactCheckDeps = {},
): Promise<number | null> {
    return judge('accurate', ACCURATE_INSTRUCTIONS, question, answer, deps);
}

/**
 * Asks Jev how likely it is that a tool's answer actually answers the question,
 * as opposed to merely being about the same subject.
 *
 * Accuracy cannot catch this: the summary of the article "Mammal" is true, so it
 * passes checkAnswer, and still says nothing about which mammal is largest.
 * Null means "unjudged": the caller keeps the tool answer, as checkAnswer's
 * callers keep an unjudged LLM answer.
 */
export async function checkRelevance(
    question: string,
    answer: string,
    deps: FactCheckDeps = {},
): Promise<number | null> {
    return judge('answers_question', RELEVANT_INSTRUCTIONS, question, answer, deps);
}

/**
 * Checks an answer against the source it was written from.
 *
 * Stronger than checkAnswer, which asks the model to judge a claim from its own
 * knowledge. Here the source is in hand, so this asks whether the two disagree.
 */
export async function checkContradiction(
    question: string,
    answer: string,
    source: string,
    deps: FactCheckDeps = {},
): Promise<number | null> {
    if (source.trim().length === 0) {
        return null;
    }
    return judge('contradicted', CONTRADICTS_INSTRUCTIONS, question, answer, deps, { source });
}
