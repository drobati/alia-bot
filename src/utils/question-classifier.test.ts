import { classify } from './question-classifier';

function fakeFetch(body: unknown, status = 200) {
    return jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });
}

const LOG = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('classify', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns the winning type, its confidence and the runners-up', async () => {
        const fetchMock = fakeFetch({
            model: 'typesafe/jev-1.13-20260917',
            answers: {
                kind: {
                    type: 'choice',
                    choice: 'general_knowledge',
                    probabilities: { general_knowledge: 0.92, directed_at_human: 0.08, weather: 0 },
                    confidence: 0.91,
                },
            },
            usage: { input_tokens: 300 },
        });

        const result = await classify('capital of France?', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });

        expect(result).toEqual({
            type: 'general_knowledge',
            confidence: 0.92,
            alternatives: [{ type: 'directed_at_human', p: 0.08 }],
        });
    });

    it('derives confidence from the distribution rather than trusting the provider field', async () => {
        // The provider's own `confidence` is ignored: the top probability is the
        // number the floor is calibrated against.
        const fetchMock = fakeFetch({
            model: 'm',
            answers: {
                kind: {
                    type: 'choice',
                    choice: 'weather',
                    probabilities: { weather: 0.95, opinion: 0.05 },
                    confidence: 0.1,
                },
            },
        });

        const result = await classify('rain?', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });

        expect(result?.confidence).toBe(0.95);
    });

    it('sends the model id and the addressed flag', async () => {
        const fetchMock = fakeFetch({
            model: 'm',
            answers: { kind: { type: 'choice', choice: 'compliment', probabilities: { compliment: 1 } } },
        });

        await classify('you rule', { addressedToBot: true },
            { fetch: fetchMock as never, apiKey: 'k', model: 'typesafe/jev-1.13', log: LOG as never });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://openrouter.ai/api/v1/systemone');
        const body = JSON.parse(init.body);
        expect(body.model).toBe('typesafe/jev-1.13');
        expect(body.state).toEqual({ discord_message: 'you rule', addressed_to_bot: true });
        expect(Object.keys(body.questions.kind.criteria)).toContain('general_knowledge');
    });

    it('returns null on a non-200 rather than throwing', async () => {
        const fetchMock = fakeFetch({ error: { message: 'nope' } }, 400);
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
        expect(LOG.error).toHaveBeenCalled();
    });

    it('returns null when the body is malformed', async () => {
        const fetchMock = fakeFetch({ answers: {} });
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
    });

    it('returns null when the model names a type we do not know', async () => {
        const fetchMock = fakeFetch({
            model: 'm',
            answers: { kind: { type: 'choice', choice: 'astrology', probabilities: { astrology: 1 } } },
        });
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
    });

    it('returns null when no api key is configured', async () => {
        const fetchMock = fakeFetch({});
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: '', log: LOG as never });
        expect(result).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null without calling fetch when JEV_MODEL is the disable switch "off"', async () => {
        const fetchMock = fakeFetch({});
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', model: 'off', log: LOG as never });
        expect(result).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('respects JEV_MODEL=off from the environment, not just an explicit dep', async () => {
        const originalModel = process.env.JEV_MODEL;
        process.env.JEV_MODEL = 'off';
        try {
            const fetchMock = fakeFetch({});
            const result = await classify('hi', { addressedToBot: false },
                { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
            expect(result).toBeNull();
            expect(fetchMock).not.toHaveBeenCalled();
        } finally {
            if (originalModel === undefined) {
                delete process.env.JEV_MODEL;
            } else {
                process.env.JEV_MODEL = originalModel;
            }
        }
    });

    it('returns null when the transport throws', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
    });
});
