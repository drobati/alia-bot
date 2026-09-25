import {
    Classification,
    QuestionType,
    TYPE_CRITERIA,
    TypeProbability,
} from './question-types';
import { BotLogger } from './logger';

const ENDPOINT = 'https://openrouter.ai/api/v1/systemone';
const DEFAULT_MODEL = 'typesafe/jev-1.13';
const TIMEOUT_MS = 8000;
const MAX_ALTERNATIVES = 2;

const INSTRUCTIONS =
    'Classify this Discord message sent in a friend-group server where a bot named Alia listens.';

export interface ClassifierDeps {
    fetch?: typeof fetch;
    apiKey?: string;
    model?: string;
    log?: BotLogger;
}

const KNOWN_TYPES = new Set(Object.keys(TYPE_CRITERIA));

function isQuestionType(value: string): value is QuestionType {
    return KNOWN_TYPES.has(value);
}

/**
 * Classifies one message with Jev. Returns null on every failure mode; the
 * caller decides what silence means, and `decide()` already treats null as
 * "no tool".
 */
export async function classify(
    content: string,
    opts: { addressedToBot: boolean },
    deps: ClassifierDeps = {},
): Promise<Classification | null> {
    // Kill switch: the passive path ships inert (no channel is opted in until
    // someone inserts a Config row by hand), but the mentioned path classifies
    // every mention the moment this deploys, with no way to stop it short of a
    // revert and redeploy. Setting JEV_MODEL=off short-circuits before any
    // network call. `null` is already the established "classification
    // unavailable" signal handled everywhere classify() is called: the
    // mentioned path degrades to today's LLM behaviour and the passive path to
    // silence, both already tested.
    if ((deps.model ?? process.env.JEV_MODEL) === 'off') {
        return null;
    }

    const doFetch = deps.fetch ?? fetch;
    const log = deps.log;
    const apiKey = deps.apiKey ?? process.env.OPENROUTER_API_KEY;
    // Never hardcoded at a call site: a retired model id is how Alia went quiet before.
    const model = deps.model ?? process.env.JEV_MODEL ?? DEFAULT_MODEL;

    if (!apiKey) {
        log?.error('Question classifier has no OPENROUTER_API_KEY; not classifying');
        return null;
    }

    const body = JSON.stringify({
        model,
        state: { discord_message: content, addressed_to_bot: opts.addressedToBot },
        questions: {
            kind: { type: 'choice', instructions: INSTRUCTIONS, criteria: TYPE_CRITERIA },
        },
    });

    try {
        const response = await doFetch(ENDPOINT, {
            method: 'POST',
            headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
            log?.error('Question classifier request failed', { status: response.status, model });
            return null;
        }

        const json = await response.json() as {
            answers?: { kind?: { choice?: string; probabilities?: Record<string, number> } };
        };
        const answer = json?.answers?.kind;
        if (!answer?.choice || !answer.probabilities) {
            log?.error('Question classifier returned an unusable answer', { model });
            return null;
        }
        if (!isQuestionType(answer.choice)) {
            log?.error('Question classifier returned an unknown type', { choice: answer.choice });
            return null;
        }

        const ranked: TypeProbability[] = Object.entries(answer.probabilities)
            .filter(([type, p]) => isQuestionType(type) && p > 0)
            .map(([type, p]) => ({ type: type as QuestionType, p }))
            .sort((a, b) => b.p - a.p);

        // The top probability is the number the floor is calibrated against.
        // The provider also returns its own `confidence`, which is not used.
        const confidence = ranked.find(entry => entry.type === answer.choice)?.p ?? 0;

        return {
            type: answer.choice,
            confidence,
            alternatives: ranked
                .filter(entry => entry.type !== answer.choice)
                .slice(0, MAX_ALTERNATIVES),
        };
    } catch (error) {
        log?.error('Question classifier threw', { error, model });
        return null;
    }
}
