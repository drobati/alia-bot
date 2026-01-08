import { describe, it, expect, beforeEach, jest } from "@jest/globals";

const mockContext = {
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const mockDisplayAvatarURL = jest.fn<any>().mockReturnValue("https://cdn.discordapp.com/avatars/123/abc.png");
const mockBannerURL = jest.fn<any>().mockReturnValue("https://cdn.discordapp.com/banners/123/def.png");
const mockIconURL = jest.fn<any>().mockReturnValue("https://cdn.discordapp.com/icons/guild/icon.png");

const createMockUser = (overrides = {}) => ({
    id: "test-user-id",
    username: "testuser",
    displayName: "Test User",
    accentColor: 0xFF5733,
    displayAvatarURL: mockDisplayAvatarURL,
    bannerURL: mockBannerURL,
    fetch: jest.fn<any>().mockResolvedValue({
        id: "test-user-id",
        username: "testuser",
        displayName: "Test User",
        accentColor: 0xFF5733,
        displayAvatarURL: mockDisplayAvatarURL,
        bannerURL: mockBannerURL,
    }),
    ...overrides,
});

const createMockGuildMember = (overrides = {}) => ({
    id: "test-user-id",
    displayAvatarURL: jest.fn<any>().mockReturnValue("https://cdn.discordapp.com/guilds/123/users/456/avatar.png"),
    ...overrides,
});

const createMockGuild = (overrides = {}) => ({
    id: "test-guild-id",
    name: "Test Server",
    iconURL: mockIconURL,
    members: {
        cache: new Map([["test-user-id", createMockGuildMember()]]),
    },
    ...overrides,
});

const createMockInteraction = (
    subcommand: string,
    targetUser: any = null,
    guild: any = createMockGuild(),
) => {
    const interactionUser = createMockUser();
    return {
        options: {
            getSubcommand: jest.fn<any>().mockReturnValue(subcommand),
            getUser: jest.fn<any>().mockReturnValue(targetUser),
        },
        reply: jest.fn<any>(),
        editReply: jest.fn<any>(),
        deferReply: jest.fn<any>(),
        deferred: false,
        replied: false,
        user: interactionUser,
        guild,
    };
};

describe("Avatar Command", () => {
    let avatarCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        avatarCommand = (await import("./avatar")).default;
    });

    describe("Command Data", () => {
        it("should have correct name and description", () => {
            expect(avatarCommand.data.name).toBe("avatar");
            expect(avatarCommand.data.description).toContain("avatar");
        });

        it("should have user subcommand", () => {
            const subcommands = avatarCommand.data.options.filter(
                (opt: any) => opt.toJSON().type === 1,
            );
            const userSubcommand = subcommands.find(
                (sub: any) => sub.toJSON().name === "user",
            );
            expect(userSubcommand).toBeDefined();
        });

        it("should have server subcommand", () => {
            const subcommands = avatarCommand.data.options.filter(
                (opt: any) => opt.toJSON().type === 1,
            );
            const serverSubcommand = subcommands.find(
                (sub: any) => sub.toJSON().name === "server",
            );
            expect(serverSubcommand).toBeDefined();
        });

        it("should have banner subcommand", () => {
            const subcommands = avatarCommand.data.options.filter(
                (opt: any) => opt.toJSON().type === 1,
            );
            const bannerSubcommand = subcommands.find(
                (sub: any) => sub.toJSON().name === "banner",
            );
            expect(bannerSubcommand).toBeDefined();
        });
    });

    describe("User Subcommand", () => {
        it("should display own avatar when no user specified", async () => {
            const mockInteraction = createMockInteraction("user", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds).toHaveLength(1);
        });

        it("should include user's display name in embed title", async () => {
            const mockInteraction = createMockInteraction("user", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Test User");
            expect(response.embeds[0].data.title).toContain("Avatar");
        });

        it("should include size links in description", async () => {
            const mockInteraction = createMockInteraction("user", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.description).toContain("PNG");
            // When user has guild avatar, description shows server/global avatars
            // When no guild avatar, description shows PNG and WebP links
        });

        it("should include WebP links when no guild avatar", async () => {
            // Create guild with member having same avatar as global
            const memberWithSameAvatar = createMockGuildMember({
                displayAvatarURL: mockDisplayAvatarURL, // Same as user's global avatar
            });
            const guildWithSameAvatar = createMockGuild({
                members: {
                    cache: new Map([["test-user-id", memberWithSameAvatar]]),
                },
            });
            const mockInteraction = createMockInteraction("user", null, guildWithSameAvatar);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.description).toContain("PNG");
            expect(response.embeds[0].data.description).toContain("WebP");
        });

        it("should display another user's avatar when specified", async () => {
            const targetUser = createMockUser({
                id: "target-user-id",
                username: "targetuser",
                displayName: "Target User",
            });
            const mockInteraction = createMockInteraction("user", targetUser);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.title).toContain("Target User");
        });

        it("should include footer with requester when viewing another user", async () => {
            const targetUser = createMockUser({
                id: "target-user-id",
                username: "targetuser",
                displayName: "Target User",
            });
            const mockInteraction = createMockInteraction("user", targetUser);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.footer.text).toContain("testuser");
        });

        it("should log avatar user command", async () => {
            const mockInteraction = createMockInteraction("user", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "avatar user command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    targetUserId: "test-user-id",
                }),
            );
        });
    });

    describe("Server Subcommand", () => {
        it("should display server icon", async () => {
            const mockInteraction = createMockInteraction("server", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toContain("Test Server");
        });

        it("should include size links for server icon", async () => {
            const mockInteraction = createMockInteraction("server", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.embeds[0].data.description).toContain("PNG");
            expect(response.embeds[0].data.description).toContain("WebP");
        });

        it("should reply with error when server has no icon", async () => {
            const guildWithNoIcon = createMockGuild({
                iconURL: jest.fn<any>().mockReturnValue(null),
            });
            const mockInteraction = createMockInteraction("server", null, guildWithNoIcon);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.content).toContain("does not have an icon");
            expect(response.ephemeral).toBe(true);
        });

        it("should log avatar server command", async () => {
            const mockInteraction = createMockInteraction("server", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "avatar server command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    guildId: "test-guild-id",
                }),
            );
        });
    });

    describe("Banner Subcommand", () => {
        it("should defer reply for banner command", async () => {
            const mockInteraction = createMockInteraction("banner", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalled();
        });

        it("should display user banner when available", async () => {
            const mockInteraction = createMockInteraction("banner", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.editReply).toHaveBeenCalled();
            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toContain("Banner");
        });

        it("should reply with message when user has no banner", async () => {
            const userWithNoBanner = createMockUser({
                fetch: jest.fn<any>().mockResolvedValue({
                    id: "test-user-id",
                    displayName: "Test User",
                    displayAvatarURL: mockDisplayAvatarURL,
                    bannerURL: jest.fn<any>().mockReturnValue(null),
                }),
            });
            const mockInteraction = createMockInteraction("banner", userWithNoBanner);
            mockInteraction.user = userWithNoBanner;

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.editReply.mock.calls[0][0] as any;
            expect(response.content).toContain("does not have a profile banner");
        });

        it("should log avatar banner command", async () => {
            const mockInteraction = createMockInteraction("banner", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.info).toHaveBeenCalledWith(
                "avatar banner command used",
                expect.objectContaining({
                    userId: "test-user-id",
                    targetUserId: "test-user-id",
                }),
            );
        });
    });

    describe("Error Handling", () => {
        it("should handle errors gracefully", async () => {
            const mockInteraction = createMockInteraction("user", null);
            mockInteraction.reply = jest.fn<any>().mockRejectedValueOnce(new Error("API Error"));
            mockInteraction.reply.mockResolvedValueOnce(undefined);

            await avatarCommand.execute(mockInteraction, mockContext);

            expect(mockContext.log.error).toHaveBeenCalled();
        });

        it("should reply with unknown subcommand message", async () => {
            const mockInteraction = createMockInteraction("invalid", null);

            await avatarCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0] as any;
            expect(response.content).toContain("Unknown subcommand");
            expect(response.ephemeral).toBe(true);
        });
    });
});
