import { complete, CompleteDeps } from './llm';

/** Long enough for one sentence with a unit conversion, short enough to stay one. */
const ANSWER_TOKENS = 90;
/** An article title is a few words; anything longer is the model ignoring the brief. */
const ENTITY_TOKENS = 16;
const MAX_ENTITY_LENGTH = 60;
/** The lead paragraph is all the summary endpoint returns; this bounds a long one. */
const MAX_SOURCE_CHARS = 1500;

const ENTITY_PROMPT = (question: string) => [
    'Name the single Wikipedia article title that answers this question.',
    'Reply with the title only — no quotes, no explanation, no punctuation after it.',
    '',
    `Question: ${question}`,
].join('\n');

const ANSWER_PROMPT = (question: string, title: string, source: string) => [
    'Answer the question in ONE short sentence, using only the source below.',
    'Include the key number or name. If the source gives metric units, add imperial in brackets.',
    'No preamble, no "according to", no closing remark.',
    '',
    `Question: ${question}`,
    '',
    `Source (${title}):`,
    source.slice(0, MAX_SOURCE_CHARS),
].join('\n');

/**
 * Names the article that answers a question whose subject is not its answer.
 *
 * Searching Wikipedia for "the largest mammal" ranks "List of largest mammals"
 * and never surfaces "Blue whale" at all; "the capital of France" ranks "Capital
 * punishment in France" above Paris. When the subject of a question is not the
 * thing that answers it, no amount of searching the subject will find it, so
 * something has to name the answer first.
 *
 * Returns null when the reply does not look like a title — a model that returns
 * a sentence is refused rather than searched for.
 */
export async function resolveAnswerEntity(
    question: string,
    deps: CompleteDeps = {},
): Promise<string | null> {
    const raw = await complete(ENTITY_PROMPT(question), ENTITY_TOKENS, deps);
    if (!raw) {
        return null;
    }

    // The model sometimes wraps the title in quotes or ends it with a full stop;
    // both would be searched literally. Strip runs of either from each end.
    const title = raw.split('\n')[0].replace(/^[\s"'`]+/, '').replace(/[\s"'`.]+$/, '');
    if (title.length === 0 || title.length > MAX_ENTITY_LENGTH) {
        return null;
    }
    // A title is a short noun phrase. A sentence is the model explaining itself.
    if (/[.!?]\s/.test(title)) {
        return null;
    }
    return title;
}

/**
 * Turns an article into a direct answer: "Mount Everest is 8,848.86 m (29,032 ft) tall."
 *
 * The article's own lead paragraph contains the answer but rarely leads with it,
 * so posting the extract makes the reader hunt for the number. The link is still
 * attached, so nothing is lost by stating the answer first.
 */
export async function writeSourcedAnswer(
    question: string,
    title: string,
    source: string,
    deps: CompleteDeps = {},
): Promise<string | null> {
    if (source.trim().length === 0) {
        return null;
    }
    return complete(ANSWER_PROMPT(question, title, source), ANSWER_TOKENS, deps);
}
