import { wikipediaTool } from './wikipedia';
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
