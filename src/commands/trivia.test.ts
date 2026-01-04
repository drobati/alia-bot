import { describe, it, expect, beforeEach, jest, afterEach } from "@jest/globals";

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
        id: "test-user-id",
        username: "testuser",
    },
});

describe("Trivia Command", () => {
    let triviaCommand: any;
    let activeGames: Map<string, any>;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        const triviaModule = await import("./trivia");
        triviaCommand = triviaModule.default;
        activeGames = triviaModule.activeGames;
        activeGames.clear();
    });

    afterEach(() => {
        activeGames?.clear();
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(triviaCommand.data.name).toBe("trivia");
            expect(triviaCommand.data.description).toContain("trivia");
        });
    });

    describe("Execute", () => {
        it("should reply with an embed and buttons", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
            expect(response.components).toBeDefined();
            expect(response.components).toHaveLength(1);
            expect(response.fetchReply).toBe(true);
        });

        it("should have Trivia in title", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.title).toContain("Trivia");
        });

        it("should include question and options in description", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.description).toContain("A.");
            expect(embed.data.description).toContain("B.");
            expect(embed.data.description).toContain("C.");
            expect(embed.data.description).toContain("D.");
        });

        it("should include time remaining field", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const timeField = embed.data.fields.find((f: any) => f.name === "Time Remaining");
            expect(timeField).toBeDefined();
            expect(timeField.value).toContain("30 seconds");
        });

        it("should have 4 answer buttons", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const actionRow = response.components[0];
            expect(actionRow.components).toHaveLength(4);
            expect(actionRow.components[0].data.label).toBe("A");
            expect(actionRow.components[1].data.label).toBe("B");
            expect(actionRow.components[2].data.label).toBe("C");
            expect(actionRow.components[3].data.label).toBe("D");
        });

        it("should log game started with category", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "trivia game started",
                expect.objectContaining({
                    userId: "test-user-id",
                    category: expect.any(String),
                    gameId: expect.any(String),
                    channelId: "test-channel-id",
                }),
            );
        });

        it("should create a message collector", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            expect(mockMessage.createMessageComponentCollector).toHaveBeenCalledWith({
                componentType: 2, // ComponentType.Button
                time: 30000,
            });
        });

        it("should add game to active games map", async () => {
            const mockInteraction = createMockInteraction("channel-123");

            await triviaCommand.execute(mockInteraction, mockContext);

            expect(activeGames.has("channel-123")).toBe(true);
        });

        it("should reject if game already active in channel", async () => {
            const mockInteraction = createMockInteraction("busy-channel");

            // First game
            await triviaCommand.execute(mockInteraction, mockContext);

            // Second game should be rejected
            const secondInteraction = createMockInteraction("busy-channel");
            await triviaCommand.execute(secondInteraction, mockContext);

            expect(secondInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("already a trivia game in progress"),
                ephemeral: true,
            });
        });
    });

    describe("Button handlers", () => {
        it("should register collect and end handlers on collector", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            expect(mockCollector.on).toHaveBeenCalledWith('collect', expect.any(Function));
            expect(mockCollector.on).toHaveBeenCalledWith('end', expect.any(Function));
        });
    });
});
