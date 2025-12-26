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

describe("Riddle Command", () => {
    let riddleCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        riddleCommand = (await import("./riddle")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(riddleCommand.data.name).toBe("riddle");
            expect(riddleCommand.data.description).toContain("riddle");
        });
    });

    describe("Execute", () => {
        it("should reply with an embed", async () => {
            const mockInteraction = createMockInteraction();

            await riddleCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it("should have Riddle in title", async () => {
            const mockInteraction = createMockInteraction();

            await riddleCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.title).toContain("Riddle");
        });

        it("should include the riddle in description", async () => {
            const mockInteraction = createMockInteraction();

            await riddleCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            expect(embed.data.description.length).toBeGreaterThan(0);
        });

        it("should include answer field with spoiler", async () => {
            const mockInteraction = createMockInteraction();

            await riddleCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const answerField = embed.data.fields.find((f: any) => f.name === "Answer");
            expect(answerField).toBeDefined();
            expect(answerField.value).toMatch(/^\|\|.*\|\|$/);
        });

        it("should log command usage", async () => {
            const mockInteraction = createMockInteraction();

            await riddleCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "riddle command used",
                expect.objectContaining({
                    userId: "test-user-id",
                }),
            );
        });
    });
});
