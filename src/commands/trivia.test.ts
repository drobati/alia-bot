import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = () => ({
    options: {},
    reply: jest.fn<any>(),
    user: {
        id: "test-user-id",
        username: "testuser",
    },
});

describe("Trivia Command", () => {
    let triviaCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        triviaCommand = (await import("./trivia")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(triviaCommand.data.name).toBe("trivia");
            expect(triviaCommand.data.description).toContain("trivia");
        });
    });

    describe("Execute", () => {
        it("should reply with an embed", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
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

        it("should include answer field with spoiler", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const answerField = embed.data.fields.find((f: any) => f.name === "Answer");
            expect(answerField).toBeDefined();
            expect(answerField.value).toMatch(/^\|\|[A-D]\./);
        });

        it("should log command usage with category", async () => {
            const mockInteraction = createMockInteraction();

            await triviaCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "trivia command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    category: expect.any(String),
                }),
            );
        });
    });
});
