import { createContext, createInteraction, createTable } from "../utils/testHelpers";
import subscribeCommand from "./subscribe";
import * as permissions from "../utils/permissions";

jest.mock("../utils/permissions", () => ({
    checkOwnerPermission: jest.fn(),
}));

describe('commands/subscribe', () => {
    let interaction: any;
    let context: any;
    let Config: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        Config = createTable();
        context.tables.Config = Config;

        // Reset mocks
        jest.clearAllMocks();

        // Default guild setup
        interaction.guildId = 'guild123';
        interaction.user = { id: 'user123' };

        // Default guild roles cache
        interaction.guild = {
            roles: {
                cache: {
                    get: jest.fn((id: string) => {
                        const roles: Record<string, any> = {
                            'role123': { id: 'role123', name: 'Test Role', managed: false },
                            'role456': { id: 'role456', name: 'Another Role', managed: false },
                            'guild123': { id: 'guild123', name: '@everyone', managed: false },
                            'botRole': { id: 'botRole', name: 'Bot Role', managed: true },
                        };
                        return roles[id];
                    }),
                },
            },
        };

        // Default member with roles (not in purgatory)
        const mockRoles = [{ id: 'existingRole', name: 'Existing Role' }];
        const mockRoleCache = {
            has: jest.fn((id: string) => mockRoles.some(r => r.id === id)),
            get: jest.fn((id: string) => mockRoles.find(r => r.id === id)),
            map: jest.fn((fn: any) => mockRoles.map(fn)),
            filter: jest.fn((fn: any) => {
                const filtered = mockRoles.filter(fn);
                return {
                    size: filtered.length,
                    map: (mapFn: any) => filtered.map(mapFn),
                };
            }),
        };
        interaction.member = {
            guild: { id: 'guild123' },
            roles: {
                cache: mockRoleCache,
                add: jest.fn().mockResolvedValue(undefined),
            },
        };
    });

    describe('command data', () => {
        it('should have correct name and description', () => {
            expect(subscribeCommand.data.name).toBe('subscribe');
            expect(subscribeCommand.data.description).toContain('Subscribe');
        });
    });

    describe('execute', () => {
        describe('basic validation', () => {
            it('should reject if not in a guild', async () => {
                interaction.guildId = null;
                interaction.options.getSubcommandGroup.mockReturnValue(null);
                interaction.options.getSubcommand.mockReturnValue('list');

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: "This command can only be used in a server.",
                    ephemeral: true,
                });
            });

            it('should reject if member not found', async () => {
                interaction.member = null;
                interaction.options.getSubcommandGroup.mockReturnValue(null);
                interaction.options.getSubcommand.mockReturnValue('list');

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: "Could not find your member information.",
                    ephemeral: true,
                });
            });
        });

        describe('config subcommand group', () => {
            beforeEach(() => {
                interaction.options.getSubcommandGroup.mockReturnValue('config');
            });

            it('should require owner permission for config add', async () => {
                interaction.options.getSubcommand.mockReturnValue('add');
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                    managed: false,
                });
                Config.findOne.mockResolvedValue(null);

                await subscribeCommand.execute(interaction, context);

                expect(permissions.checkOwnerPermission).toHaveBeenCalledWith(interaction, context);
            });

            it('should add a role to the whitelist', async () => {
                interaction.options.getSubcommand.mockReturnValue('add');
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                    managed: false,
                });
                Config.findOne.mockResolvedValue(null);

                await subscribeCommand.execute(interaction, context);

                expect(Config.upsert).toHaveBeenCalledWith({
                    key: 'subscribe_allowed_roles_guild123',
                    value: JSON.stringify(['role123']),
                });
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: 'Added **Test Role** to the subscription whitelist.',
                    ephemeral: true,
                });
            });

            it('should reject adding @everyone role', async () => {
                interaction.options.getSubcommand.mockReturnValue('add');
                interaction.options.getRole.mockReturnValue({
                    id: 'guild123',
                    name: '@everyone',
                    managed: false,
                });

                await subscribeCommand.execute(interaction, context);

                expect(Config.upsert).not.toHaveBeenCalled();
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: "You cannot add the @everyone role to the subscription list.",
                    ephemeral: true,
                });
            });

            it('should reject adding managed roles', async () => {
                interaction.options.getSubcommand.mockReturnValue('add');
                interaction.options.getRole.mockReturnValue({
                    id: 'botRole',
                    name: 'Bot Role',
                    managed: true,
                });

                await subscribeCommand.execute(interaction, context);

                expect(Config.upsert).not.toHaveBeenCalled();
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: "You cannot add managed roles (bot roles, integration roles) "
                        + "to the subscription list.",
                    ephemeral: true,
                });
            });

            it('should reject adding duplicate role', async () => {
                interaction.options.getSubcommand.mockReturnValue('add');
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                    managed: false,
                });
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });

                await subscribeCommand.execute(interaction, context);

                expect(Config.upsert).not.toHaveBeenCalled();
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: '**Test Role** is already in the subscription whitelist.',
                    ephemeral: true,
                });
            });

            it('should remove a role from the whitelist', async () => {
                interaction.options.getSubcommand.mockReturnValue('remove');
                interaction.options.getString.mockReturnValue('role123');
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123', 'role456']),
                });

                await subscribeCommand.execute(interaction, context);

                expect(Config.upsert).toHaveBeenCalledWith({
                    key: 'subscribe_allowed_roles_guild123',
                    value: JSON.stringify(['role456']),
                });
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: 'Removed **Test Role** from the subscription whitelist.',
                    ephemeral: true,
                });
            });

            it('should reject removing role not in whitelist', async () => {
                interaction.options.getSubcommand.mockReturnValue('remove');
                interaction.options.getString.mockReturnValue('role999');
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });

                await subscribeCommand.execute(interaction, context);

                expect(Config.upsert).not.toHaveBeenCalled();
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: "That role is not in the subscription whitelist.",
                    ephemeral: true,
                });
            });

            it('should list whitelisted roles', async () => {
                interaction.options.getSubcommand.mockReturnValue('list');
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123', 'role456']),
                });

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('**Subscribable Roles:**'),
                    ephemeral: true,
                });
            });

            it('should show message when no roles configured', async () => {
                interaction.options.getSubcommand.mockReturnValue('list');
                Config.findOne.mockResolvedValue(null);

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No roles are configured'),
                    ephemeral: true,
                });
            });
        });

        describe('list subcommand', () => {
            beforeEach(() => {
                interaction.options.getSubcommandGroup.mockReturnValue(null);
                interaction.options.getSubcommand.mockReturnValue('list');
            });

            it('should list available roles', async () => {
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123', 'role456']),
                });

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('**Available Roles:**'),
                    ephemeral: true,
                });
            });

            it('should show no roles message when none configured', async () => {
                Config.findOne.mockResolvedValue(null);

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: "No roles are available for subscription.",
                    ephemeral: true,
                });
            });

            it('should indicate which roles user already has', async () => {
                interaction.member.roles.cache.map = jest.fn().mockReturnValue(['role123']);
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('*(subscribed)*'),
                    ephemeral: true,
                });
            });
        });

        describe('role subcommand', () => {
            beforeEach(() => {
                interaction.options.getSubcommandGroup.mockReturnValue(null);
                interaction.options.getSubcommand.mockReturnValue('role');
            });

            it('should reject users in purgatory (no roles)', async () => {
                // User has no roles besides @everyone
                interaction.member.roles.cache.filter = jest.fn().mockReturnValue({ size: 0 });
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                });

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('must be verified'),
                    ephemeral: true,
                });
            });

            it('should reject if no roles configured', async () => {
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                });
                Config.findOne.mockResolvedValue(null);

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: "No roles are configured for subscription.",
                    ephemeral: true,
                });
            });

            it('should reject if role not in whitelist', async () => {
                interaction.options.getRole.mockReturnValue({
                    id: 'role999',
                    name: 'Unknown Role',
                });
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('is not available for subscription'),
                    ephemeral: true,
                });
            });

            it('should reject if user already has the role', async () => {
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                });
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });
                interaction.member.roles.cache.has = jest.fn().mockReturnValue(true);

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: 'You already have the **Test Role** role.',
                    ephemeral: true,
                });
            });

            it('should successfully add role to user', async () => {
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                });
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });
                interaction.member.roles.cache.has = jest.fn().mockReturnValue(false);

                await subscribeCommand.execute(interaction, context);

                expect(interaction.member.roles.add).toHaveBeenCalledWith(
                    'role123',
                    'User subscribed via /subscribe command',
                );
                expect(interaction.reply).toHaveBeenCalledWith({
                    content: 'You have subscribed to **Test Role**.',
                    ephemeral: true,
                });
            });

            it('should handle role assignment errors', async () => {
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                });
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });
                interaction.member.roles.cache.has = jest.fn().mockReturnValue(false);
                interaction.member.roles.add = jest.fn().mockRejectedValue(
                    new Error('Missing permissions'),
                );

                await subscribeCommand.execute(interaction, context);

                expect(interaction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('error adding the role'),
                    ephemeral: true,
                });
                expect(context.log.error).toHaveBeenCalled();
            });

            it('should log successful subscription', async () => {
                interaction.options.getRole.mockReturnValue({
                    id: 'role123',
                    name: 'Test Role',
                });
                Config.findOne.mockResolvedValue({
                    value: JSON.stringify(['role123']),
                });
                interaction.member.roles.cache.has = jest.fn().mockReturnValue(false);

                await subscribeCommand.execute(interaction, context);

                expect(context.log.info).toHaveBeenCalledWith(
                    expect.objectContaining({
                        guildId: 'guild123',
                        userId: 'user123',
                        roleId: 'role123',
                        roleName: 'Test Role',
                    }),
                    'User subscribed to role',
                );
            });
        });
    });

    describe('autocomplete', () => {
        beforeEach(() => {
            interaction.options.getFocused = jest.fn().mockReturnValue('');
        });

        it('should return empty if no guildId', async () => {
            interaction.guildId = null;

            await subscribeCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('should return empty for non-config subcommands', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue(null);
            interaction.options.getSubcommand.mockReturnValue('list');

            await subscribeCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('should provide autocomplete for config remove', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('config');
            interaction.options.getSubcommand.mockReturnValue('remove');
            Config.findOne.mockResolvedValue({
                value: JSON.stringify(['role123', 'role456']),
            });

            await subscribeCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'Test Role', value: 'role123' },
                { name: 'Another Role', value: 'role456' },
            ]);
        });

        it('should filter autocomplete by search term', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('config');
            interaction.options.getSubcommand.mockReturnValue('remove');
            interaction.options.getFocused.mockReturnValue('another');
            Config.findOne.mockResolvedValue({
                value: JSON.stringify(['role123', 'role456']),
            });

            await subscribeCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'Another Role', value: 'role456' },
            ]);
        });

        it('should return empty if no roles in whitelist', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('config');
            interaction.options.getSubcommand.mockReturnValue('remove');
            Config.findOne.mockResolvedValue(null);

            await subscribeCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('should handle errors gracefully', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('config');
            interaction.options.getSubcommand.mockReturnValue('remove');
            Config.findOne.mockRejectedValue(new Error('Database error'));

            await subscribeCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
            expect(context.log.error).toHaveBeenCalled();
        });

        it('should limit results to 25', async () => {
            interaction.options.getSubcommandGroup.mockReturnValue('config');
            interaction.options.getSubcommand.mockReturnValue('remove');

            const manyRoles = Array.from({ length: 30 }, (_, i) => `role${i}`);
            Config.findOne.mockResolvedValue({
                value: JSON.stringify(manyRoles),
            });

            // Mock guild roles cache to return all roles
            interaction.guild.roles.cache.get = jest.fn((id: string) => ({
                id,
                name: `Role ${id}`,
            }));

            await subscribeCommand.autocomplete(interaction, context);

            const response = (interaction.respond as jest.Mock).mock.calls[0][0];
            expect(response.length).toBeLessThanOrEqual(25);
        });
    });
});
