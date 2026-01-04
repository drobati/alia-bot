import { describe, it, expect, beforeEach, afterEach, jest } from '@jest/globals';

const mockCollector = {
    on: jest.fn<any>(),
};

const mockMessage = {
    id: "test-message-id",
    createMessageComponentCollector: jest.fn<any>().mockReturnValue(mockCollector),
    edit: jest.fn<any>(),
};

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (channelId = "test-channel-id") => ({
    options: {},
    channelId,
    reply: jest.fn<any>().mockResolvedValue(mockMessage),
    user: {
        id: 'test-user-id',
        username: 'testuser',
    },
});

describe('RPS Command', () => {
    let rpsCommand: any;
    let activeGames: Map<string, any>;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        const rpsModule = await import('./rps');
        rpsCommand = rpsModule.default;
        activeGames = rpsModule.activeGames;
        activeGames.clear();
    });

    afterEach(() => {
        activeGames?.clear();
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(rpsCommand.data.name).toBe('rps');
            expect(rpsCommand.data.description).toContain('Rock-Paper-Scissors');
        });

        it('should not have choice option (now uses buttons)', () => {
            const options = rpsCommand.data.options;
            expect(options).toHaveLength(0);
        });
    });

    describe('Execute', () => {
        it('should reply with an embed and buttons', async () => {
            const mockInteraction = createMockInteraction();

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
            expect(response.components).toBeDefined();
            expect(response.components).toHaveLength(1);
            expect(response.fetchReply).toBe(true);
        });

        it('should have Rock-Paper-Scissors in title', async () => {
            const mockInteraction = createMockInteraction();

            await rpsCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.title).toContain('Rock-Paper-Scissors');
        });

        it('should include time field', async () => {
            const mockInteraction = createMockInteraction();

            await rpsCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const timeField = embed.data.fields.find((f: any) => f.name === "⏱️ Time");
            expect(timeField).toBeDefined();
            expect(timeField.value).toContain("15 seconds");
        });

        it('should have 3 choice buttons', async () => {
            const mockInteraction = createMockInteraction();

            await rpsCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const actionRow = response.components[0];
            expect(actionRow.components).toHaveLength(3);
            expect(actionRow.components[0].data.label).toContain('Rock');
            expect(actionRow.components[1].data.label).toContain('Paper');
            expect(actionRow.components[2].data.label).toContain('Scissors');
        });

        it('should log game started', async () => {
            const mockInteraction = createMockInteraction();

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                'rps game started',
                expect.objectContaining({
                    userId: 'test-user-id',
                    botChoice: expect.stringMatching(/rock|paper|scissors/),
                    gameId: expect.any(String),
                    channelId: "test-channel-id",
                }),
            );
        });

        it('should create a message collector', async () => {
            const mockInteraction = createMockInteraction();

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockMessage.createMessageComponentCollector).toHaveBeenCalledWith({
                componentType: 2,
                time: 15000,
            });
        });

        it('should add game to active games map', async () => {
            const mockInteraction = createMockInteraction("channel-123");

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(activeGames.has("channel-123")).toBe(true);
        });

        it('should reject if game already active in channel', async () => {
            const mockInteraction = createMockInteraction("busy-channel");

            // First game
            await rpsCommand.execute(mockInteraction, mockContext);

            // Second game should be rejected
            const secondInteraction = createMockInteraction("busy-channel");
            await rpsCommand.execute(secondInteraction, mockContext);

            expect(secondInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("already an RPS game in progress"),
                ephemeral: true,
            });
        });
    });

    describe('Button handlers', () => {
        it('should register collect and end handlers on collector', async () => {
            const mockInteraction = createMockInteraction();

            await rpsCommand.execute(mockInteraction, mockContext);

            expect(mockCollector.on).toHaveBeenCalledWith('collect', expect.any(Function));
            expect(mockCollector.on).toHaveBeenCalledWith('end', expect.any(Function));
        });
    });
});
