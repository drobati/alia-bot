import questions, { resetQuestionCooldowns } from './questions';
import { createContext } from '../utils/testHelpers';

jest.mock('../utils/answer-runner', () => ({ answerQuestion: jest.fn() }));
jest.mock('../utils/passive-channels', () => ({ isPassiveChannel: jest.fn() }));

import { answerQuestion } from '../utils/answer-runner';
import { isPassiveChannel } from '../utils/passive-channels';

function messageOf(content: string, overrides: Record<string, unknown> = {}) {
    return {
        content,
        id: 'm1',
        guildId: 'g1',
        channelId: 'c1',
        author: { bot: false, id: 'u1' },
        channel: { send: jest.fn() },
        ...overrides,
    };
}

describe('questions (passive)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetQuestionCooldowns();
        (isPassiveChannel as jest.Mock).mockResolvedValue(true);
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'answered' });
    });

    it('handles a message ending in a question mark', async () => {
        expect(await questions(messageOf("what's the capital of France?") as never, createContext() as never))
            .toBe(true);
        expect(answerQuestion).toHaveBeenCalledWith(
            expect.anything(), expect.anything(),
            { content: "what's the capital of France?", addressedToBot: false },
        );
    });

    it.each(['huh?!', 'really!?', 'wait???'])('accepts trailing punctuation %s', async content => {
        await questions(messageOf(`something something ${content}`) as never, createContext() as never);
        expect(answerQuestion).toHaveBeenCalled();
    });

    it('ignores a message with no question mark', async () => {
        expect(await questions(messageOf('you smell') as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('ignores bots', async () => {
        const message = messageOf('what is it?', { author: { bot: true, id: 'b1' } });
        expect(await questions(message as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('ignores direct messages', async () => {
        const message = messageOf('what is it?', { guildId: null });
        expect(await questions(message as never, createContext() as never)).toBe(false);
    });

    it('does not classify in a channel nobody opted in', async () => {
        (isPassiveChannel as jest.Mock).mockResolvedValue(false);
        expect(await questions(messageOf('what is it?') as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('ignores a message too short to be a real question', async () => {
        expect(await questions(messageOf('ok?') as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('reports not-handled when the runner stays silent', async () => {
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'silent' });
        expect(await questions(messageOf('you coming tonight?') as never, createContext() as never))
            .toBe(false);
    });

    it('reports not-handled when the runner asks for the LLM, since passive never uses it', async () => {
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'llm' });
        expect(await questions(messageOf('what is anything?') as never, createContext() as never))
            .toBe(false);
    });

    it('applies a per-channel cooldown after answering', async () => {
        const context = createContext();
        await questions(messageOf('what is the first thing?') as never, context as never);
        await questions(messageOf('what is the second thing?') as never, context as never);
        expect(answerQuestion).toHaveBeenCalledTimes(1);
    });

    it('does not start the cooldown when it did not answer', async () => {
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'silent' });
        const context = createContext();
        await questions(messageOf('what is the first thing?') as never, context as never);
        await questions(messageOf('what is the second thing?') as never, context as never);
        expect(answerQuestion).toHaveBeenCalledTimes(2);
    });

    it('returns false when the runner throws', async () => {
        (answerQuestion as jest.Mock).mockRejectedValue(new Error('boom'));
        const context = createContext();
        expect(await questions(messageOf('what is it really?') as never, context as never)).toBe(false);
        expect(context.log.error).toHaveBeenCalled();
    });
});
