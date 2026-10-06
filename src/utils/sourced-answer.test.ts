import { resolveAnswerEntity, writeSourcedAnswer } from './sourced-answer';

function clientReturning(...texts: (string | null)[]) {
    const create = jest.fn();
    for (const t of texts) {
        create.mockResolvedValueOnce(
            t === null ? { choices: [{ message: {} }] } : { choices: [{ message: { content: t } }] },
        );
    }
    return { client: { chat: { completions: { create } } }, create };
}

const LOG = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('resolveAnswerEntity', () => {
    beforeEach(() => jest.clearAllMocks());

    it('names the article that answers a question whose subject is not its answer', async () => {
        const { client } = clientReturning('Blue whale');

        const title = await resolveAnswerEntity("what's the largest mammal?", {
            client: client as never, log: LOG as never,
        });

        expect(title).toBe('Blue whale');
    });

    it('strips quoting and trailing punctuation the model adds', async () => {
        const { client } = clientReturning('"Burj Khalifa".');

        expect(await resolveAnswerEntity('tallest building?', {
            client: client as never, log: LOG as never,
        })).toBe('Burj Khalifa');
    });

    it('refuses a reply that is a sentence rather than a title', async () => {
        // Searching Wikipedia for a sentence finds nothing useful, so this is
        // rejected outright rather than passed on as a lookup.
        const { client } = clientReturning('The largest mammal is the blue whale. It is very big.');

        expect(await resolveAnswerEntity('q', { client: client as never, log: LOG as never })).toBeNull();
    });

    it('refuses a reply too long to be a title', async () => {
        const { client } = clientReturning('x'.repeat(80));

        expect(await resolveAnswerEntity('q', { client: client as never, log: LOG as never })).toBeNull();
    });

    it('takes only the first line when the model adds commentary below', async () => {
        const { client } = clientReturning('Paris\n\nThis is the capital of France.');

        expect(await resolveAnswerEntity('q', { client: client as never, log: LOG as never })).toBe('Paris');
    });

    it('returns null when the completion fails', async () => {
        const create = jest.fn().mockRejectedValue(new Error('upstream down'));

        expect(await resolveAnswerEntity('q', {
            client: { chat: { completions: { create } } } as never, log: LOG as never,
        })).toBeNull();
    });
});

describe('writeSourcedAnswer', () => {
    beforeEach(() => jest.clearAllMocks());

    it('states the answer directly rather than quoting the article', async () => {
        const { client } = clientReturning('Mount Everest is 8,848.86 m (29,032 ft) tall.');

        const answer = await writeSourcedAnswer(
            'how tall is mount everest?',
            'Mount Everest',
            'Mount Everest is the highest mountain on Earth. Its height was most recently measured at 8,848.86 m.',
            { client: client as never, log: LOG as never },
        );

        expect(answer).toBe('Mount Everest is 8,848.86 m (29,032 ft) tall.');
    });

    it('gives the model the question, the title and the source', async () => {
        const { client, create } = clientReturning('An answer.');

        await writeSourcedAnswer('how tall?', 'Mount Everest', 'It is 8,848.86 m.', {
            client: client as never, log: LOG as never,
        });

        const prompt = (create.mock.calls[0][0] as { messages: { content: string }[] }).messages[0].content;
        expect(prompt).toContain('how tall?');
        expect(prompt).toContain('Mount Everest');
        expect(prompt).toContain('8,848.86 m');
    });

    it('does not spend a call when there is no source to answer from', async () => {
        const { client, create } = clientReturning('should not be used');

        expect(await writeSourcedAnswer('q', 't', '   ', {
            client: client as never, log: LOG as never,
        })).toBeNull();
        expect(create).not.toHaveBeenCalled();
    });

    it('returns null when the completion fails', async () => {
        const create = jest.fn().mockRejectedValue(new Error('upstream down'));

        expect(await writeSourcedAnswer('q', 't', 'source text', {
            client: { chat: { completions: { create } } } as never, log: LOG as never,
        })).toBeNull();
    });
});
