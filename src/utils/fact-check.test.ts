import { checkAnswer, FACT_CHECK_FLOOR } from './fact-check';

function fakeFetch(body: unknown, status = 200) {
    return jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });
}

const LOG = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

const accurate = (p: number) => ({
    model: 'typesafe/jev-1.13-20260917',
    answers: { accurate: { type: 'noul', noul: p } },
    usage: { input_tokens: 120 },
});

describe('FACT_CHECK_FLOOR', () => {
    it('sits in the gap measured between false and true claims', () => {
        // Measured against the live model: true claims scored 0.95-0.99,
        // false ones 0.01-0.30. Anything inside that gap is defensible;
        // anything outside it is not.
        expect(FACT_CHECK_FLOOR).toBeGreaterThan(0.3);
        expect(FACT_CHECK_FLOOR).toBeLessThan(0.95);
    });
});

describe('checkAnswer', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns the probability that the answer is accurate', async () => {
        const fetchMock = fakeFetch(accurate(0.97));

        const p = await checkAnswer('what is the largest mammal?', 'The blue whale.', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        });

        expect(p).toBe(0.97);
    });

    it('sends the question and the answer together, so the claim can be judged in context', async () => {
        const fetchMock = fakeFetch(accurate(0.9));

        await checkAnswer('capital of France?', 'Paris.', {
            fetch: fetchMock as never, apiKey: 'k', model: 'typesafe/jev-1.13', log: LOG as never,
        });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://openrouter.ai/api/v1/systemone');
        const body = JSON.parse(init.body);
        expect(body.model).toBe('typesafe/jev-1.13');
        expect(body.state).toEqual({ question: 'capital of France?', answer: 'Paris.' });
        expect(body.questions.accurate.type).toBe('noul');
    });

    it('is disabled by the same kill switch as the classifier', async () => {
        const fetchMock = fakeFetch(accurate(0.97));

        const p = await checkAnswer('q', 'a', {
            fetch: fetchMock as never, apiKey: 'k', model: 'off', log: LOG as never,
        });

        expect(p).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null without calling out when there is no api key', async () => {
        const fetchMock = fakeFetch(accurate(0.97));

        expect(await checkAnswer('q', 'a', {
            fetch: fetchMock as never, apiKey: '', log: LOG as never,
        })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null on a non-200 rather than throwing', async () => {
        const fetchMock = fakeFetch({ error: 'nope' }, 400);

        expect(await checkAnswer('q', 'a', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        })).toBeNull();
    });

    it('returns null when the body is malformed', async () => {
        const fetchMock = fakeFetch({ answers: {} });

        expect(await checkAnswer('q', 'a', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        })).toBeNull();
    });

    it('returns null when the probability is not a usable number', async () => {
        const fetchMock = fakeFetch({ answers: { accurate: { type: 'noul', noul: 'very' } } });

        expect(await checkAnswer('q', 'a', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        })).toBeNull();
    });

    it('returns null when the transport throws', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));

        expect(await checkAnswer('q', 'a', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        })).toBeNull();
    });

    it('does not spend a call on an empty answer', async () => {
        const fetchMock = fakeFetch(accurate(0.9));

        expect(await checkAnswer('q', '   ', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
