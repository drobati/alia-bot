import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (targetUser: any = null) => ({
    options: {
        getUser: jest.fn<any>().mockReturnValue(targetUser),
    },
    reply: jest.fn<any>(),
    user: {
        id: "test-user-id",
        username: "testuser",
        displayAvatarURL: jest.fn<any>().mockReturnValue("https://example.com/avatar.png"),
    },
});

const mockTargetUser = {
    id: "target-user-id",
    username: "targetuser",
    displayAvatarURL: jest.fn<any>().mockReturnValue("https://example.com/target-avatar.png"),
};

describe("Roast Command", () => {
    let roastCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        roastCommand = (await import("./roast")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(roastCommand.data.name).toBe("roast");
            expect(roastCommand.data.description).toContain("roast");
        });

        it("should have optional user option", () => {
            const options = roastCommand.data.options;
            const userOption = options.find((opt: any) => opt.name === "user");
            expect(userOption).toBeDefined();
            expect(userOption.required).toBe(false);
        });
    });

    describe("Execute - Self Roast", () => {
        it("should reply with an embed for self-roast", async () => {
            const mockInteraction = createMockInteraction(null);

            await roastCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it("should have Roast in title", async () => {
            const mockInteraction = createMockInteraction(null);

            await roastCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Roast");
        });

        it("should include self-roast footer", async () => {
            const mockInteraction = createMockInteraction(null);

            await roastCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.footer.text).toContain("Self-roast");
        });

        it("should log with isSelf true", async () => {
            const mockInteraction = createMockInteraction(null);

            await roastCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "roast command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    targetUserId: "test-user-id",
                    isSelf: true,
                }),
            );
        });
    });

    describe("Execute - Roasting Another User", () => {
        it("should reply with embed when target user specified", async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await roastCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
        });

        it("should include requester in footer", async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await roastCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.footer.text).toContain("testuser");
        });

        it("should include target username in description", async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await roastCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.description).toContain("targetuser");
        });

        it("should log with isSelf false", async () => {
            const mockInteraction = createMockInteraction(mockTargetUser);

            await roastCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "roast command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    targetUserId: "target-user-id",
                    isSelf: false,
                }),
            );
        });
    });
});
