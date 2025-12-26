import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (category: string | null = null) => ({
    options: {
        getString: jest.fn<any>().mockReturnValue(category),
    },
    reply: jest.fn<any>(),
    user: {
        id: "test-user-id",
        username: "testuser",
    },
});

describe("Joke Command", () => {
    let jokeCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        jokeCommand = (await import("./joke")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(jokeCommand.data.name).toBe("joke");
            expect(jokeCommand.data.description).toContain("joke");
        });

        it("should have optional category option", () => {
            const options = jokeCommand.data.options;
            const categoryOption = options.find((opt: any) => opt.name === "category");
            expect(categoryOption).toBeDefined();
            expect(categoryOption.required).toBe(false);
        });

        it("should have three category choices", () => {
            const options = jokeCommand.data.options;
            const categoryOption = options.find((opt: any) => opt.name === "category");
            expect(categoryOption.choices).toHaveLength(3);
        });
    });

    describe("Execute", () => {
        it("should reply with an embed", async () => {
            const mockInteraction = createMockInteraction();

            await jokeCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it("should include setup and punchline fields", async () => {
            const mockInteraction = createMockInteraction();

            await jokeCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const fieldNames = embed.data.fields.map((f: any) => f.name);
            expect(fieldNames).toContain("Setup");
            expect(fieldNames).toContain("Punchline");
        });

        it("should use spoiler tags for punchline", async () => {
            const mockInteraction = createMockInteraction();

            await jokeCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const punchlineField = embed.data.fields.find((f: any) => f.name === "Punchline");
            expect(punchlineField.value).toMatch(/^\|\|.*\|\|$/);
        });

        it("should work with specific category", async () => {
            const mockInteraction = createMockInteraction("programming");

            await jokeCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Programming");
        });

        it("should log command usage", async () => {
            const mockInteraction = createMockInteraction();

            await jokeCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "joke command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    category: expect.any(String),
                }),
            );
        });
    });
});
