import { wikipediaTool, toSearchTerms } from './wikipedia';
import { createContext } from '../utils/testHelpers';

const ctx = () => ({ message: {} as never, context: createContext() as never });

function fetchReturning(...responses: Array<{ status: number; body: unknown }>) {
    const mock = jest.fn();
    for (const r of responses) {
        mock.mockResolvedValueOnce({
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            json: async () => r.body,
        });
    }
    return mock;
}

describe('toSearchTerms', () => {
    // The bug this exists for: Wikipedia returned the WhatsApp article, because
    // "whats" outscores everything else in the sentence.
    it('strips the interrogative so the subject is what gets searched', () => {
        expect(toSearchTerms("What's the capital of France?")).toBe('the capital of France');
        expect(toSearchTerms('What is the capital of France?')).toBe('the capital of France');
    });

    it('never leaves "what" or "whats" in the search terms', () => {
        for (const q of ["What's the capital of France?", 'What is photosynthesis?', 'what are quasars?']) {
            expect(toSearchTerms(q).toLowerCase()).not.toMatch(/\bwhat'?s?\b/);
        }
    });

    it.each([
        ['how tall is mount everest?', 'mount everest'],
        ['who is marie curie?', 'marie curie'],
        ['who was napoleon?', 'napoleon'],
        ['tell me about the roman empire', 'the roman empire'],
        ["what's a black hole?", 'a black hole'],
        ['where is the eiffel tower?', 'the eiffel tower'],
    ])('normalises %s', (asked, expected) => {
        expect(toSearchTerms(asked)).toBe(expected);
    });

    it('preserves word order, since reordering makes results worse', () => {
        // "France capital" returns "Capital punishment in France".
        expect(toSearchTerms('What is the capital of France?')).toBe('the capital of France');
    });

    it('leaves a query with no interrogative wrapper alone', () => {
        expect(toSearchTerms('mount everest')).toBe('mount everest');
    });

    it('falls back to the original text rather than searching an empty string', () => {
        expect(toSearchTerms('what is?')).toBe('what is?');
    });
});

describe('wikipediaTool', () => {
    it('answers with the summary extract and links the article', async () => {
        const fetchMock = fetchReturning(
            { status: 200, body: { query: { search: [{ title: 'Paris' }] } } },
            {
                status: 200,
                body: {
                    title: 'Paris',
                    extract: 'Paris is the capital and largest city of France.',
                    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Paris' } },
                },
            },
        );

        const answer = await wikipediaTool.run("what's the capital of France?", ctx(), { fetch: fetchMock as never });

        expect(answer).toEqual({
            title: 'Paris',
            body: 'Paris is the capital and largest city of France.',
            url: 'https://en.wikipedia.org/wiki/Paris',
            sourceLabel: 'Wikipedia',
        });
    });

    it('returns null when nothing matches, so the caller can fall back', async () => {
        const fetchMock = fetchReturning({ status: 200, body: { query: { search: [] } } });
        expect(await wikipediaTool.run('asdfqwer', ctx(), { fetch: fetchMock as never })).toBeNull();
        expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('returns null when the article has no extract', async () => {
        const fetchMock = fetchReturning(
            { status: 200, body: { query: { search: [{ title: 'Empty' }] } } },
            { status: 200, body: { title: 'Empty', extract: '' } },
        );
        expect(await wikipediaTool.run('empty', ctx(), { fetch: fetchMock as never })).toBeNull();
    });

    it('returns null on a transport error rather than throwing', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
        expect(await wikipediaTool.run('paris', ctx(), { fetch: fetchMock as never })).toBeNull();
    });

    it('returns null on a non-200', async () => {
        const fetchMock = fetchReturning({ status: 500, body: {} });
        expect(await wikipediaTool.run('paris', ctx(), { fetch: fetchMock as never })).toBeNull();
    });

    it('returns null on a non-200 from the summary endpoint', async () => {
        const fetchMock = fetchReturning(
            { status: 200, body: { query: { search: [{ title: 'Paris' }] } } },
            { status: 500, body: {} },
        );
        expect(await wikipediaTool.run('paris', ctx(), { fetch: fetchMock as never })).toBeNull();
    });

    it('truncates long extracts to MAX_BODY', async () => {
        const longExtract = 'x'.repeat(3000);
        const fetchMock = fetchReturning(
            { status: 200, body: { query: { search: [{ title: 'LongArticle' }] } } },
            {
                status: 200,
                body: {
                    title: 'LongArticle',
                    extract: longExtract,
                    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/LongArticle' } },
                },
            },
        );

        const answer = await wikipediaTool.run('long', ctx(), { fetch: fetchMock as never });

        expect(answer).not.toBeNull();
        expect(answer!.body).toHaveLength(1200);
        expect(answer!.body).toBe(longExtract.slice(0, 1200));
    });
});
