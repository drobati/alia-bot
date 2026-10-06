import {
    checkAnswer,
    checkRelevance,
    FACT_CHECK_FLOOR,
    RELEVANCE_FLOOR,
    checkContradiction,
    CONTRADICTION_CEILING,
} from './fact-check';

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

describe('checkRelevance', () => {
    beforeEach(() => jest.clearAllMocks());

    const answersQuestion = (p: number) => ({
        answers: { answers_question: { type: 'noul', noul: p } },
    });

    it('returns the probability that the text answers the question', async () => {
        const fetchMock = fakeFetch(answersQuestion(0.06));

        const p = await checkRelevance("What's the largest mammal?", 'Mammal: A mammal is a vertebrate...', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        });

        expect(p).toBe(0.06);
    });

    it('asks whether the answer is stated, not whether it is true', async () => {
        // An accurate but off-topic summary passes an accuracy check, which was the bug.
        const fetchMock = fakeFetch(answersQuestion(0.9));

        await checkRelevance('q', 'a', { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(Object.keys(body.questions)).toEqual(['answers_question']);
        expect(body.questions.answers_question.type).toBe('noul');
        expect(body.questions.answers_question.instructions).toMatch(/directly state/);
        expect(body.state).toEqual({ question: 'q', answer: 'a' });
    });

    it('does not read the accuracy key as a relevance score', async () => {
        const fetchMock = fakeFetch(accurate(0.97));

        expect(await checkRelevance('q', 'a', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        })).toBeNull();
    });

    it('honours the kill switch', async () => {
        const fetchMock = fakeFetch(answersQuestion(0.9));

        expect(await checkRelevance('q', 'a', {
            fetch: fetchMock as never, apiKey: 'k', model: 'off', log: LOG as never,
        })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('has a floor between zero and one', () => {
        expect(RELEVANCE_FLOOR).toBeGreaterThan(0);
        expect(RELEVANCE_FLOOR).toBeLessThan(1);
    });
});

describe('checkContradiction', () => {
    beforeEach(() => jest.clearAllMocks());

    it('is low when the source agrees, even if the answer converts units', async () => {
        // "Is this supported?" scored a metric-to-imperial conversion at 0.83 and
        // would have hedged it. Contradiction framing leaves it alone.
        const fetchMock = fakeFetch({ answers: { contradicted: { type: 'noul', noul: 0.02 } } });

        const p = await checkContradiction(
            'how tall is everest?',
            'Mount Everest is 8,848.86 m (29,032 ft) tall.',
            'Its height was most recently measured at 8,848.86 m.',
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never },
        );

        expect(p).toBe(0.02);
        expect(p).toBeLessThan(CONTRADICTION_CEILING);
    });

    it('is high when the source disagrees with the answer', async () => {
        const fetchMock = fakeFetch({ answers: { contradicted: { type: 'noul', noul: 0.97 } } });

        const p = await checkContradiction(
            'how tall is everest?',
            'Mount Everest is 12,000 m tall.',
            'Its height was most recently measured at 8,848.86 m.',
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never },
        );

        expect(p).toBeGreaterThan(CONTRADICTION_CEILING);
    });

    it('sends the source alongside the question and answer', async () => {
        const fetchMock = fakeFetch({ answers: { contradicted: { type: 'noul', noul: 0.1 } } });

        await checkContradiction('q', 'a', 'the source text', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        });

        const body = JSON.parse(fetchMock.mock.calls[0][1].body);
        expect(body.state).toEqual({ question: 'q', answer: 'a', source: 'the source text' });
    });

    it('does not spend a call when there is no source to check against', async () => {
        const fetchMock = fakeFetch({ answers: { contradicted: { type: 'noul', noul: 0.1 } } });

        expect(await checkContradiction('q', 'a', '  ', {
            fetch: fetchMock as never, apiKey: 'k', log: LOG as never,
        })).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('sits in the gap measured between correct and wrong answers', () => {
        // Correct answers measured 0.02-0.03, wrong ones 0.86-0.99.
        expect(CONTRADICTION_CEILING).toBeGreaterThan(0.03);
        expect(CONTRADICTION_CEILING).toBeLessThan(0.86);
    });
});
