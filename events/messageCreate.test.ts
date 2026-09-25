import { createContext, createTable } from "../src/utils/testHelpers";

jest.mock('../src/utils/spam-shield', () => ({
    evaluateMessage: jest.fn().mockResolvedValue(false),
}));

// ttsChannel pulls in ../src/utils/permissions -> ../src/lib/sentry, which in
// this checkout fails to load a native binary (@sentry-internal/node-cpu-profiler)
// that isn't present under the symlinked node_modules. That's an unrelated,
// pre-existing environment problem (the same one that fails
// src/responses/ttsChannel.test.ts and src/responses/assistant.test.ts).
// It has nothing to do with the ordering contract this suite pins, so the
// module is mocked out here rather than worked around.
jest.mock('../src/responses/ttsChannel', () => ({
    __esModule: true,
    default: jest.fn().mockResolvedValue(false),
}));

jest.mock('../src/responses', () => ({
    __esModule: true,
    default: {
        Password: jest.fn().mockResolvedValue(false),
        Dnd: jest.fn().mockResolvedValue(false),
        Descriptions: jest.fn().mockResolvedValue(false),
        Assistant: jest.fn().mockResolvedValue(false),
        Questions: jest.fn().mockResolvedValue(false),
        Triggers: jest.fn().mockResolvedValue(false),
        Greetings: jest.fn().mockResolvedValue(false),
        Adlibs: jest.fn().mockResolvedValue(false),
        Louds: jest.fn().mockResolvedValue(false),
        Tips: jest.fn().mockResolvedValue(false),
    },
}));

import messageCreateEvent from "./messageCreate";
import response from "../src/responses";

// This suite pins the DISPATCHER's ordering contract, not the individual
// handlers (each has its own tests). The property that matters: earlier
// handlers in the priority chain get first refusal, Questions sits right
// after Assistant, and a handler that answers stops everything behind it.
// Silently regressing this order would mean Alia's passive Q&A hijacks
// messages meant for the D&D game or the password flow.
describe('events/messageCreate - handler ordering', () => {
    function messageOf(overrides: Record<string, unknown> = {}) {
        return {
            content: 'does this even matter?',
            id: 'm1',
            guildId: 'g1',
            channelId: 'c1',
            author: { bot: false, id: 'test-user-id' },
            ...overrides,
        };
    }

    beforeEach(() => {
        jest.clearAllMocks();
        (response.Password as jest.Mock).mockResolvedValue(false);
        (response.Dnd as jest.Mock).mockResolvedValue(false);
        (response.Descriptions as jest.Mock).mockResolvedValue(false);
        (response.Assistant as jest.Mock).mockResolvedValue(false);
        (response.Questions as jest.Mock).mockResolvedValue(false);
        (response.Triggers as jest.Mock).mockResolvedValue(false);
        (response.Greetings as jest.Mock).mockResolvedValue(false);
        (response.Adlibs as jest.Mock).mockResolvedValue(false);
        (response.Louds as jest.Mock).mockResolvedValue(false);
        (response.Tips as jest.Mock).mockResolvedValue(false);
    });

    function makeContext() {
        const context = createContext();
        context.tables.Config = createTable();
        return context;
    }

    it('calls Questions when every earlier handler declines', async () => {
        const context = makeContext();
        await messageCreateEvent.execute(messageOf() as never, context as never);

        expect(response.Password).toHaveBeenCalled();
        expect(response.Dnd).toHaveBeenCalled();
        expect(response.Descriptions).toHaveBeenCalled();
        expect(response.Assistant).toHaveBeenCalled();
        expect(response.Questions).toHaveBeenCalled();
    });

    it('does not call Questions when Password already handled the message', async () => {
        (response.Password as jest.Mock).mockResolvedValue(true);
        const context = makeContext();
        await messageCreateEvent.execute(messageOf() as never, context as never);

        expect(response.Questions).not.toHaveBeenCalled();
        // Nothing downstream of Password runs either.
        expect(response.Dnd).not.toHaveBeenCalled();
        expect(response.Assistant).not.toHaveBeenCalled();
    });

    it('does not call Questions when Dnd already handled the message', async () => {
        (response.Dnd as jest.Mock).mockResolvedValue(true);
        const context = makeContext();
        await messageCreateEvent.execute(messageOf() as never, context as never);

        expect(response.Questions).not.toHaveBeenCalled();
        expect(response.Assistant).not.toHaveBeenCalled();
    });

    it('does not call Questions when Assistant already handled the message', async () => {
        (response.Assistant as jest.Mock).mockResolvedValue(true);
        const context = makeContext();
        await messageCreateEvent.execute(messageOf() as never, context as never);

        expect(response.Assistant).toHaveBeenCalled();
        expect(response.Questions).not.toHaveBeenCalled();
    });

    it('does not call handlers after Questions when Questions handled the message', async () => {
        (response.Questions as jest.Mock).mockResolvedValue(true);
        const context = makeContext();
        await messageCreateEvent.execute(messageOf() as never, context as never);

        expect(response.Questions).toHaveBeenCalled();
        expect(response.Triggers).not.toHaveBeenCalled();
        expect(response.Greetings).not.toHaveBeenCalled();
        expect(response.Adlibs).not.toHaveBeenCalled();
        expect(response.Louds).not.toHaveBeenCalled();
        expect(response.Tips).not.toHaveBeenCalled();
    });
});
