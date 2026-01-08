import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (
    subcommand: string,
    options: Record<string, string | null> = {},
) => ({
    options: {
        getSubcommand: jest.fn<any>().mockReturnValue(subcommand),
        getString: jest.fn<any>().mockImplementation((name: string) => options[name] ?? null),
    },
    reply: jest.fn<any>(),
    editReply: jest.fn<any>(),
    deferred: false,
    replied: false,
    user: {
        id: "test-user-id",
        username: "testuser",
    },
});

describe("Color Command", () => {
    let colorCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        colorCommand = (await import("./color")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(colorCommand.data.name).toBe("color");
            expect(colorCommand.data.description).toContain("Color");
        });

        it("should have info subcommand", () => {
            const subcommands = colorCommand.data.options.filter(
                (opt: any) => opt.toJSON().type === 1,
            );
            const infoSubcommand = subcommands.find(
                (sub: any) => sub.toJSON().name === "info",
            );
            expect(infoSubcommand).toBeDefined();
        });

        it("should have palette subcommand", () => {
            const subcommands = colorCommand.data.options.filter(
                (opt: any) => opt.toJSON().type === 1,
            );
            const paletteSubcommand = subcommands.find(
                (sub: any) => sub.toJSON().name === "palette",
            );
            expect(paletteSubcommand).toBeDefined();
        });

        it("should have random subcommand", () => {
            const subcommands = colorCommand.data.options.filter(
                (opt: any) => opt.toJSON().type === 1,
            );
            const randomSubcommand = subcommands.find(
                (sub: any) => sub.toJSON().name === "random",
            );
            expect(randomSubcommand).toBeDefined();
        });

        it("should have contrast subcommand", () => {
            const subcommands = colorCommand.data.options.filter(
                (opt: any) => opt.toJSON().type === 1,
            );
            const contrastSubcommand = subcommands.find(
                (sub: any) => sub.toJSON().name === "contrast",
            );
            expect(contrastSubcommand).toBeDefined();
        });
    });

    describe("Info Subcommand", () => {
        it("should display color info for valid hex", async () => {
            const mockInteraction = createMockInteraction("info", { color: "#ff0000" });

            await colorCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it("should include hex, RGB, and HSL values", async () => {
            const mockInteraction = createMockInteraction("info", { color: "#ff0000" });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const embed = response.embeds[0];
            const fields = embed.data.fields;

            const hexField = fields.find((f: any) => f.name === "Hex");
            const rgbField = fields.find((f: any) => f.name === "RGB");
            const hslField = fields.find((f: any) => f.name === "HSL");

            expect(hexField).toBeDefined();
            expect(rgbField).toBeDefined();
            expect(hslField).toBeDefined();
        });

        it("should include contrast information", async () => {
            const mockInteraction = createMockInteraction("info", { color: "#ff0000" });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const fields = response.embeds[0].data.fields;

            const whiteContrastField = fields.find((f: any) => f.name === "Contrast with White");
            const blackContrastField = fields.find((f: any) => f.name === "Contrast with Black");

            expect(whiteContrastField).toBeDefined();
            expect(blackContrastField).toBeDefined();
        });

        it("should reject invalid color format", async () => {
            const mockInteraction = createMockInteraction("info", { color: "invalid" });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.content).toContain("Invalid color format");
            expect(response.ephemeral).toBe(true);
        });

        it("should accept RGB format", async () => {
            const mockInteraction = createMockInteraction("info", { color: "255, 0, 0" });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
        });

        it("should log command usage", async () => {
            const mockInteraction = createMockInteraction("info", { color: "#ff0000" });

            await colorCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "color info command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    color: "#ff0000",
                }),
            );
        });
    });

    describe("Palette Subcommand", () => {
        it("should generate complementary palette", async () => {
            const mockInteraction = createMockInteraction("palette", {
                color: "#ff0000",
                type: "complementary",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toContain("Complementary");
        });

        it("should generate analogous palette", async () => {
            const mockInteraction = createMockInteraction("palette", {
                color: "#ff0000",
                type: "analogous",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Analogous");
        });

        it("should generate triadic palette", async () => {
            const mockInteraction = createMockInteraction("palette", {
                color: "#ff0000",
                type: "triadic",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Triadic");
        });

        it("should generate split complementary palette", async () => {
            const mockInteraction = createMockInteraction("palette", {
                color: "#ff0000",
                type: "split",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Split");
        });

        it("should reject invalid color", async () => {
            const mockInteraction = createMockInteraction("palette", {
                color: "invalid",
                type: "complementary",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.content).toContain("Invalid color format");
            expect(response.ephemeral).toBe(true);
        });

        it("should log palette command usage", async () => {
            const mockInteraction = createMockInteraction("palette", {
                color: "#ff0000",
                type: "triadic",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "color palette command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    paletteType: "triadic",
                }),
            );
        });
    });

    describe("Random Subcommand", () => {
        it("should generate a random color", async () => {
            const mockInteraction = createMockInteraction("random");

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toBe("Random Color");
        });

        it("should log random command usage", async () => {
            const mockInteraction = createMockInteraction("random");

            await colorCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "color random command used",
                expect.objectContaining({
                    userId: "test-user-id",
                }),
            );
        });
    });

    describe("Contrast Subcommand", () => {
        it("should calculate contrast between two colors", async () => {
            const mockInteraction = createMockInteraction("contrast", {
                color1: "#ffffff",
                color2: "#000000",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toBe("Contrast Ratio");
        });

        it("should show WCAG compliance info", async () => {
            const mockInteraction = createMockInteraction("contrast", {
                color1: "#ffffff",
                color2: "#000000",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const fields = response.embeds[0].data.fields;

            const wcagField = fields.find((f: any) => f.name === "WCAG Level");
            expect(wcagField).toBeDefined();
            expect(wcagField.value).toBe("AAA");
        });

        it("should show pass/fail for normal and large text", async () => {
            const mockInteraction = createMockInteraction("contrast", {
                color1: "#ffffff",
                color2: "#000000",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            const fields = response.embeds[0].data.fields;

            const normalTextField = fields.find((f: any) => f.name === "Normal Text");
            const largeTextField = fields.find((f: any) => f.name === "Large Text");

            expect(normalTextField.value).toBe("Pass");
            expect(largeTextField.value).toBe("Pass");
        });

        it("should reject invalid colors", async () => {
            const mockInteraction = createMockInteraction("contrast", {
                color1: "invalid",
                color2: "#000000",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.content).toContain("Invalid color format");
            expect(response.ephemeral).toBe(true);
        });

        it("should log contrast command usage", async () => {
            const mockInteraction = createMockInteraction("contrast", {
                color1: "#ffffff",
                color2: "#000000",
            });

            await colorCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "color contrast command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    color1: "#ffffff",
                    color2: "#000000",
                }),
            );
        });
    });

    describe("Error Handling", () => {
        it("should handle unknown subcommand", async () => {
            const mockInteraction = createMockInteraction("unknown");

            await colorCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.content).toContain("Unknown subcommand");
            expect(response.ephemeral).toBe(true);
        });

        it("should handle errors gracefully", async () => {
            const mockInteraction = createMockInteraction("info", { color: "#ff0000" });
            mockInteraction.reply = jest.fn<any>().mockRejectedValueOnce(new Error("API Error"));
            mockInteraction.reply.mockResolvedValueOnce(undefined);

            await colorCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
        });
    });
});
