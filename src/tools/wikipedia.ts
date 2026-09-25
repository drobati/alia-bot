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

export const wikipediaTool: Tool = {
    name: 'wikipedia',

    async run(query: string, _ctx: ToolContext, deps: WikipediaDeps = {}): Promise<ToolAnswer | null> {
        const doFetch = deps.fetch ?? fetch;
        try {
            const searchUrl =
                `${SEARCH_URL}?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(query)}`;
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
