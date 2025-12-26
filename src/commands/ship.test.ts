import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const mockUser1 = {
    id: "user-1-id",
    username: "Alice",
};

const mockUser2 = {
    id: "user-2-id",
    username: "Bob",
};

const createMockInteraction = (user1: any, user2: any = null) => ({
    options: {
        // eslint-disable-next-line no-unused-vars, @typescript-eslint/no-unused-vars
        getUser: jest.fn<any>().mockImplementation((name: string, _required?: boolean) => {
            if (name === "user1") {
                return user1;
            }
            if (name === "user2") {
                return user2;
            }
            return null;
        }),
    },
    reply: jest.fn<any>(),
    user: {
        id: "requester-id",
        username: "requester",
    },
});

describe("Ship Command", () => {
    let shipCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        shipCommand = (await import("./ship")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(shipCommand.data.name).toBe("ship");
            expect(shipCommand.data.description).toContain("compatibility");
        });

        it("should have required user1 option", () => {
            const options = shipCommand.data.options;
            const user1Option = options.find((opt: any) => opt.name === "user1");
            expect(user1Option).toBeDefined();
            expect(user1Option.required).toBe(true);
        });

        it("should have optional user2 option", () => {
            const options = shipCommand.data.options;
            const user2Option = options.find((opt: any) => opt.name === "user2");
            expect(user2Option).toBeDefined();
            expect(user2Option.required).toBe(false);
        });
    });

    describe("Execute", () => {
        it("should reply with an embed", async () => {
            const mockInteraction = createMockInteraction(mockUser1, mockUser2);

            await shipCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it("should have Ship Calculator in title", async () => {
            const mockInteraction = createMockInteraction(mockUser1, mockUser2);

            await shipCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Ship Calculator");
        });

        it("should include ship name field", async () => {
            const mockInteraction = createMockInteraction(mockUser1, mockUser2);

            await shipCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const fields = response.embeds[0].data.fields;
            const shipNameField = fields.find((f: any) => f.name === "Ship Name");
            expect(shipNameField).toBeDefined();
        });

        it("should include compatibility field", async () => {
            const mockInteraction = createMockInteraction(mockUser1, mockUser2);

            await shipCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const fields = response.embeds[0].data.fields;
            const compatField = fields.find((f: any) => f.name === "Compatibility");
            expect(compatField).toBeDefined();
            expect(compatField.value).toMatch(/\d+%/);
        });

        it("should include love meter field", async () => {
            const mockInteraction = createMockInteraction(mockUser1, mockUser2);

            await shipCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const fields = response.embeds[0].data.fields;
            const loveMeterField = fields.find((f: any) => f.name === "Love Meter");
            expect(loveMeterField).toBeDefined();
            expect(loveMeterField.value.length).toBeGreaterThan(0);
        });

        it("should return consistent results for same user pair", async () => {
            const mockInteraction1 = createMockInteraction(mockUser1, mockUser2);
            const mockInteraction2 = createMockInteraction(mockUser1, mockUser2);

            await shipCommand.execute(mockInteraction1, mockContext);
            await shipCommand.execute(mockInteraction2, mockContext);

            const response1 = mockInteraction1.reply.mock.calls[0][0] as any;
            const response2 = mockInteraction2.reply.mock.calls[0][0] as any;

            const compat1 = response1.embeds[0].data.fields.find((f: any) => f.name === "Compatibility");
            const compat2 = response2.embeds[0].data.fields.find((f: any) => f.name === "Compatibility");

            expect(compat1.value).toBe(compat2.value);
        });

        it("should use requester as user2 when not specified", async () => {
            const mockInteraction = createMockInteraction(mockUser1, null);

            await shipCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "ship command used",
                expect.objectContaining({
                    user2Id: "requester-id",
                }),
            );
        });

        it("should log command usage", async () => {
            const mockInteraction = createMockInteraction(mockUser1, mockUser2);

            await shipCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "ship command used",
                expect.objectContaining({
                    userId: "requester-id",
                    user1Id: "user-1-id",
                    user2Id: "user-2-id",
                    compatibility: expect.any(Number),
                }),
            );
        });
    });

    describe("Same User Ship", () => {
        it("should return 100% compatibility for same user", async () => {
            const mockInteraction = createMockInteraction(mockUser1, mockUser1);

            await shipCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const compatField = response.embeds[0].data.fields.find(
                (f: any) => f.name === "Compatibility",
            );
            expect(compatField.value).toBe("**100%**");
        });
    });
});
