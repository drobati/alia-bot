import { answerQuestion } from './answer-runner';
import { createContext, createTable } from './testHelpers';

jest.mock('./question-classifier', () => ({ classify: jest.fn() }));
jest.mock('../tools', () => ({
    TOOLS: {
        wikipedia: { name: 'wikipedia', run: jest.fn() },
        weather: { name: 'weather', run: jest.fn() },
    },
}));

import { classify } from './question-classifier';
import { TOOLS } from '../tools';

function setup() {
    const context = createContext();
    context.tables.ClassificationLog = createTable();
    const send = jest.fn().mockResolvedValue(undefined);
    const reply = jest.fn().mockResolvedValue(undefined);
    const isSendable = jest.fn().mockReturnValue(true);
    const message = {
        id: 'm1', guildId: 'g1', channelId: 'c1',
        channel: { send, isSendable },
        reply,
    };
    return { context, message, send, reply };
}

describe('answerQuestion', () => {
    beforeEach(() => jest.resetAllMocks());

    it('sends an embed when a confident tool answers', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.95, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockResolvedValue({
            title: 'Paris', body: 'Capital of France.', sourceLabel: 'Wikipedia',
        });
        const { context, message, reply, send } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'capital of France?', addressedToBot: false });

        expect(outcome).toEqual({ kind: 'answered' });
        // Passive answers reply to the message; they do not post loose into the channel.
        expect(reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
        expect(send).not.toHaveBeenCalled();
    });

    it('sends rather than replies when she was addressed', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'weather', confidence: 0.95, alternatives: [],
        });
        (TOOLS.weather.run as jest.Mock).mockResolvedValue({
            title: 'Tokyo', body: '18°C', sourceLabel: 'open-meteo',
        });
        const { context, message, reply, send } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'what is the weather in tokyo?', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'answered' });
        expect(send).toHaveBeenCalled();
        expect(reply).not.toHaveBeenCalled();
        expect(TOOLS.weather.run).toHaveBeenCalled();
        expect(TOOLS.wikipedia.run).not.toHaveBeenCalled();
    });

    it('asks the caller for the LLM when addressed and no tool applies', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'banter_insult', confidence: 0.99, alternatives: [],
        });
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'you smell', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
        expect(TOOLS.wikipedia.run).not.toHaveBeenCalled();
    });

    it('stays silent when not addressed and no tool applies', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'directed_at_human', confidence: 0.98, alternatives: [],
        });
        const { context, message, send, reply } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'you coming tonight?', addressedToBot: false });

        expect(outcome).toEqual({ kind: 'silent' });
        expect(send).not.toHaveBeenCalled();
        expect(reply).not.toHaveBeenCalled();
        expect(TOOLS.wikipedia.run).not.toHaveBeenCalled();
        // A confident non-tool type is the routine case and writes no row.
        expect(context.tables.ClassificationLog.create).not.toHaveBeenCalled();
    });

    it('logs a below-floor classification', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.5,
            alternatives: [{ type: 'directed_at_human', p: 0.4 }],
        });
        const { context, message } = setup();

        await answerQuestion(message as never, context as never,
            { content: 'how do i get to the airport?', addressedToBot: false });

        expect(context.tables.ClassificationLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'below_floor', route: 'silent' }),
        );
        expect(TOOLS.wikipedia.run).not.toHaveBeenCalled();
    });

    it('logs separately when routing was right but the tool could not answer', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.97, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockResolvedValue(null);
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'asdfqwer?', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
        expect(context.tables.ClassificationLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'tool_no_answer', route: 'tool:wikipedia' }),
        );
    });

    it('falls back to the LLM when the classifier fails and she was addressed', async () => {
        (classify as jest.Mock).mockResolvedValue(null);
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'anything', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
        expect(TOOLS.wikipedia.run).not.toHaveBeenCalled();
        // A null classification writes no row: there is nothing to diagnose.
        expect(context.tables.ClassificationLog.create).not.toHaveBeenCalled();
    });

    it('falls back to the LLM when sending the embed throws', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.95, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockResolvedValue({
            title: 'Paris', body: 'b', sourceLabel: 'Wikipedia',
        });
        const { context, message, send } = setup();
        send.mockRejectedValue(new Error('missing permissions'));

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'capital of France?', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
        expect(send).toHaveBeenCalled();
    });

    it('falls back to the LLM when the tool itself throws', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.95, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockRejectedValue(new Error('boom'));
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'capital of France?', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
        expect(TOOLS.wikipedia.run).toHaveBeenCalled();
    });
});
