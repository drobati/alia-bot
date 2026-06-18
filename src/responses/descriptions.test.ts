import { createContext, createTable } from "../utils/testHelpers";
import descriptions, { parseDescription } from "./descriptions";

describe('response/descriptions', () => {
    let context: any;
    let message: any;
    let mockReact: jest.Mock;
    let UserDescriptions: ReturnType<typeof createTable>;

    const buildMessage = (overrides: Record<string, unknown> = {}) => ({
        content: '<@111222333> is a badass guitarist',
        author: { id: 'creator-456', bot: false },
        guildId: 'guild-123',
        id: 'msg-123',
        inGuild: () => true,
        mentions: { users: new Map([['111222333', { id: '111222333' }]]) },
        react: mockReact,
        ...overrides,
    });

    beforeEach(() => {
        context = createContext();
        UserDescriptions = createTable();
        context.tables.UserDescriptions = UserDescriptions;
        mockReact = jest.fn().mockResolvedValue(undefined);
        message = buildMessage();
    });

    describe('parseDescription', () => {
        it('parses a "@user is ..." message', () => {
            expect(parseDescription(buildMessage() as never)).toEqual({
                userId: '111222333',
                description: 'a badass guitarist',
            });
        });

        it('strips a trailing period', () => {
            const result = parseDescription(buildMessage({ content: '<@111222333> is cool.' }) as never);
            expect(result).toEqual({ userId: '111222333', description: 'cool' });
        });

        it('ignores messages from bots', () => {
            expect(parseDescription(buildMessage({ author: { id: 'x', bot: true } }) as never)).toBeNull();
        });

        it('ignores messages outside a guild', () => {
            expect(parseDescription(buildMessage({ inGuild: () => false }) as never)).toBeNull();
        });

        it('ignores plain text without a real mention', () => {
            const result = parseDescription(buildMessage({
                content: 'bones is cute',
                mentions: { users: new Map() },
            }) as never);
            expect(result).toBeNull();
        });

        it('ignores a mention that is not actually a server mention', () => {
            const result = parseDescription(buildMessage({
                mentions: { users: new Map() },
            }) as never);
            expect(result).toBeNull();
        });

        it('ignores questions', () => {
            const result = parseDescription(buildMessage({ content: '<@111222333> is cute?' }) as never);
            expect(result).toBeNull();
        });

        it('ignores overly long descriptions', () => {
            const long = 'x'.repeat(201);
            expect(parseDescription(buildMessage({ content: `<@111222333> is ${long}` }) as never)).toBeNull();
        });

        it('ignores "@user is" with no description', () => {
            const result = parseDescription(buildMessage({ content: '<@111222333> is   ' }) as never);
            expect(result).toBeNull();
        });
    });

    describe('capture handler', () => {
        it('stores a new description and reacts', async () => {
            UserDescriptions.findOne.mockResolvedValue(null);
            UserDescriptions.create.mockResolvedValue({});

            const result = await descriptions(message, context);

            expect(result).toBe(true);
            expect(UserDescriptions.create).toHaveBeenCalledWith({
                guild_id: 'guild-123',
                user_id: '111222333',
                description: 'a badass guitarist',
                creator_id: 'creator-456',
            });
            expect(mockReact).toHaveBeenCalledWith('📝');
        });

        it('does not duplicate an existing description but still reacts', async () => {
            UserDescriptions.findOne.mockResolvedValue({ id: 1 });

            const result = await descriptions(message, context);

            expect(result).toBe(true);
            expect(UserDescriptions.create).not.toHaveBeenCalled();
            expect(mockReact).toHaveBeenCalledWith('📝');
        });

        it('returns false for non-description messages', async () => {
            message = buildMessage({ content: 'hello everyone' });

            const result = await descriptions(message, context);

            expect(result).toBe(false);
            expect(UserDescriptions.findOne).not.toHaveBeenCalled();
            expect(mockReact).not.toHaveBeenCalled();
        });

        it('still succeeds if reacting fails', async () => {
            UserDescriptions.findOne.mockResolvedValue(null);
            UserDescriptions.create.mockResolvedValue({});
            mockReact.mockRejectedValue(new Error('missing perms'));

            const result = await descriptions(message, context);

            expect(result).toBe(true);
        });

        it('returns false and logs when the database errors', async () => {
            UserDescriptions.findOne.mockRejectedValue(new Error('db down'));

            const result = await descriptions(message, context);

            expect(result).toBe(false);
            expect(context.log.error).toHaveBeenCalled();
        });
    });
});
