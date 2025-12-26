import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (subcommand: string, options: Record<string, any> = {}) => ({
    options: {
        getSubcommand: jest.fn<any>().mockReturnValue(subcommand),
        getInteger: jest.fn<any>().mockImplementation((name: string) => options[name] ?? null),
    },
    reply: jest.fn<any>(),
    user: {
        id: "test-user-id",
        username: "testuser",
    },
});

describe("Guess Command", () => {
    let guessCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        guessCommand = (await import("./guess")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(guessCommand.data.name).toBe("guess");
            expect(guessCommand.data.description).toContain("guessing");
        });

        it("should have three subcommands", () => {
            const options = guessCommand.data.options;
            expect(options).toHaveLength(3);
        });

        it("should have start, number, and quit subcommands", () => {
            const subcommandNames = guessCommand.data.options.map((opt: any) => opt.name);
            expect(subcommandNames).toContain("start");
            expect(subcommandNames).toContain("number");
            expect(subcommandNames).toContain("quit");
        });
    });

    describe("Execute - Start", () => {
        it("should start a new game", async () => {
            const mockInteraction = createMockInteraction("start");

            await guessCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toContain("Guessing Game");
        });

        it("should log game start", async () => {
            const mockInteraction = createMockInteraction("start");

            await guessCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "guess game started",
                expect.objectContaining({
                    userId: "test-user-id",
                }),
            );
        });

        it("should use custom max value when provided", async () => {
            const mockInteraction = createMockInteraction("start", { max: 50 });

            await guessCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "guess game started",
                expect.objectContaining({
                    max: 50,
                }),
            );
        });
    });

    describe("Execute - Number (no active game)", () => {
        it("should return error if no active game", async () => {
            // Ensure no active game by using fresh user
            const mockInteraction = createMockInteraction("number", { value: 50 });
            mockInteraction.user.id = "no-game-user";

            await guessCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("No Active Game");
            expect(response.ephemeral).toBe(true);
        });
    });

    describe("Execute - Quit (no active game)", () => {
        it("should return warning if no game to quit", async () => {
            const mockInteraction = createMockInteraction("quit");
            mockInteraction.user.id = "no-game-user-2";

            await guessCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("No Active Game");
            expect(response.ephemeral).toBe(true);
        });
    });
});
