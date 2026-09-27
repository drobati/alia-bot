import { Tool, ToolAnswer, ToolContext } from './types';

const SEARCH_URL = 'https://en.wikipedia.org/w/api.php';
const SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const TIMEOUT_MS = 6000;
const MAX_BODY = 1200;

export interface WikipediaDeps {
    fetch?: typeof fetch;
}

async function getJson(url: string, doFetch: typeof fetch): Promise<any | null> {
    const response = await doFetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'alia-bot (https://github.com/drobati/alia-bot)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? await response.json() : null;
}

/**
 * Wikipedia's search ranks the whole string, so an interrogative wrapper competes
 * with the subject and can win outright: "What's the capital of France?" returned
 * the article for WhatsApp, because "whats" scores against "WhatsApp" more strongly
 * than anything in the rest of the sentence. "What is the capital of France?"
 * returned "Closed-ended question" for the same reason.
 *
 * Stripping the lead-in and trailing punctuation leaves the subject. Word order is
 * preserved deliberately — reordering makes results worse, not better
 * ("France capital" returns "Capital punishment in France").
 */
const QUESTION_LEAD_IN = new RegExp(
    '^\\s*(?:'
    + "(?:what|who|where|when|why|which)(?:'s|s)?(?:\\s+(?:is|are|was|were)\\b)?"
    + '|how\\s+(?:tall|big|old|far|long|deep|high|heavy|fast|wide|much|many)\\s+(?:is|are|was|were)'
    + '|tell\\s+me\\s+about'
    + ')\\s+',
    'i',
);

/** Left alone, these are what remains of a question with no subject in it. */
const STOPWORDS_ONLY = new Set(['', 'is', 'are', 'was', 'were', 'the', 'a', 'an', 'of']);

export function toSearchTerms(query: string): string {
    const stripped = query.replace(QUESTION_LEAD_IN, '').replace(/[?!.]+\s*$/, '').trim();
    // A degenerate question such as "what is?" strips down to a stopword, which
    // would search Wikipedia for "is". Keep the original text instead; the search
    // will find nothing useful either way, but it will not pretend to have a subject.
    return STOPWORDS_ONLY.has(stripped.toLowerCase()) ? query.trim() : stripped;
}

export const wikipediaTool: Tool = {
    name: 'wikipedia',

    async run(query: string, _ctx: ToolContext, deps: WikipediaDeps = {}): Promise<ToolAnswer | null> {
        const doFetch = deps.fetch ?? fetch;
        try {
            const searchUrl =
                `${SEARCH_URL}?action=query&list=search&format=json&srlimit=1`
                + `&srsearch=${encodeURIComponent(toSearchTerms(query))}`;
            const search = await getJson(searchUrl, doFetch);
            const title = search?.query?.search?.[0]?.title;
            if (!title) {
                return null;
            }

            const summary = await getJson(`${SUMMARY_URL}/${encodeURIComponent(title)}`, doFetch);
            const extract: string | undefined = summary?.extract;
            if (!extract) {
                return null;
            }

            return {
                title: summary.title ?? title,
                body: extract.slice(0, MAX_BODY),
                url: summary?.content_urls?.desktop?.page,
                sourceLabel: 'Wikipedia',
            };
        } catch {
            // A lookup that cannot complete is a tool that cannot answer.
            return null;
        }
    },
};
