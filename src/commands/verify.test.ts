import { createContext, createInteraction, createTable } from "../utils/testHelpers";
import verifyCommand from "./verify";

describe('commands/verify', () => {
    let interaction: any;
    let context: any;
    let Config: any;
    let VerificationCode: any;

    beforeEach(() => {
        interaction = createInteraction();
        context = createContext();
        Config = createTable();
        VerificationCode = createTable();
        context.tables.Config = Config;
        context.tables.VerificationCode = VerificationCode;

        // Default guild setup
        interaction.guildId = 'guild123';
        interaction.user = { id: 'user123' };

        // Default member with roles - using a Collection-like mock
        const mockRoles = [{ id: 'role123', name: 'Test Role' }];
        const mockRoleCache = {
            has: jest.fn((id: string) => mockRoles.some(r => r.id === id)),
            get: jest.fn((id: string) => mockRoles.find(r => r.id === id)),
            map: jest.fn((fn: any) => mockRoles.map(fn)),
            filter: jest.fn((fn: any) => {
                const filtered = mockRoles.filter(fn);
                return {
                    map: (mapFn: any) => filtered.map(mapFn),
                    filter: (filterFn: any) => filtered.filter(filterFn),
                    slice: (start: number, end: number) => filtered.slice(start, end),
                };
            }),
        };
        interaction.member = {
            roles: {
                cache: mockRoleCache,
            },
        };
    });

    describe('command data', () => {
        it('should have correct name and description', () => {
            expect(verifyCommand.data.name).toBe('verify');
            expect(verifyCommand.data.description).toContain('verification code');
        });
    });

    describe('execute', () => {
        it('should reject if not in a guild', async () => {
            interaction.guildId = null;

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "This command can only be used in a server.",
                ephemeral: true,
            });
        });

        it('should reject if member not found', async () => {
            interaction.member = null;

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "Could not find your member information.",
                ephemeral: true,
            });
        });

        it('should reject if no roles configured', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne.mockResolvedValue(null);

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("No roles have been configured"),
                ephemeral: true,
            });
        });

        it('should reject if role not in allowed list', async () => {
            interaction.options.getString.mockReturnValue('role456');
            Config.findOne.mockResolvedValue({ value: JSON.stringify(['role123']) });

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "That role isn't available for verification.",
                ephemeral: true,
            });
        });

        it('should reject if user does not have the role', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne.mockResolvedValue({ value: JSON.stringify(['role123']) });
            interaction.member.roles.cache.has = jest.fn().mockReturnValue(false);

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: "You don't have that role.",
                ephemeral: true,
            });
        });

        it('should reject if user has too many active codes', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne
                .mockResolvedValueOnce({ value: JSON.stringify(['role123']) }) // allowed roles
                .mockResolvedValueOnce(null); // expiration (uses default)
            VerificationCode.count.mockResolvedValue(5);

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("You've reached the limit of 5 active codes"),
                ephemeral: true,
            });
        });

        it('should generate and store verification code successfully', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne
                .mockResolvedValueOnce({ value: JSON.stringify(['role123']) }) // allowed roles
                .mockResolvedValueOnce(null); // expiration (uses default)
            VerificationCode.count.mockResolvedValue(0);
            VerificationCode.findOne.mockResolvedValue(null); // no collision
            VerificationCode.create.mockResolvedValue({});

            await verifyCommand.execute(interaction, context);

            expect(VerificationCode.create).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: 'guild123',
                    generatorId: 'user123',
                    roleId: 'role123',
                    used: false,
                }),
            );
            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringMatching(/Your verification code is: \*\*V-[A-HJ-NP-Z2-9]{6}\*\*/),
                ephemeral: true,
            });
        });

        it('should display correct expiration for hours', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne
                .mockResolvedValueOnce({ value: JSON.stringify(['role123']) })
                .mockResolvedValueOnce({ value: '7200' }); // 2 hours
            VerificationCode.count.mockResolvedValue(0);
            VerificationCode.findOne.mockResolvedValue(null);
            VerificationCode.create.mockResolvedValue({});

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('2 hour(s)'),
                ephemeral: true,
            });
        });

        it('should display correct expiration for days', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne
                .mockResolvedValueOnce({ value: JSON.stringify(['role123']) })
                .mockResolvedValueOnce({ value: '172800' }); // 2 days
            VerificationCode.count.mockResolvedValue(0);
            VerificationCode.findOne.mockResolvedValue(null);
            VerificationCode.create.mockResolvedValue({});

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('2 day(s)'),
                ephemeral: true,
            });
        });

        it('should retry on code collision', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne
                .mockResolvedValueOnce({ value: JSON.stringify(['role123']) })
                .mockResolvedValueOnce(null);
            VerificationCode.count.mockResolvedValue(0);
            // First attempt collides, second succeeds
            VerificationCode.findOne
                .mockResolvedValueOnce({ code: 'V-EXIST1' })
                .mockResolvedValueOnce(null);
            VerificationCode.create.mockResolvedValue({});

            await verifyCommand.execute(interaction, context);

            expect(VerificationCode.findOne).toHaveBeenCalledTimes(2);
            expect(VerificationCode.create).toHaveBeenCalled();
        });

        it('should fail after max collision attempts', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne
                .mockResolvedValueOnce({ value: JSON.stringify(['role123']) })
                .mockResolvedValueOnce(null);
            VerificationCode.count.mockResolvedValue(0);
            // All attempts collide
            VerificationCode.findOne.mockResolvedValue({ code: 'V-EXISTS' });

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("there was an error"),
                ephemeral: true,
            });
        });

        it('should handle database errors gracefully', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne.mockRejectedValue(new Error('Database error'));

            await verifyCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining("there was an error"),
                ephemeral: true,
            });
            expect(context.log.error).toHaveBeenCalled();
        });

        it('should log successful code generation', async () => {
            interaction.options.getString.mockReturnValue('role123');
            Config.findOne
                .mockResolvedValueOnce({ value: JSON.stringify(['role123']) })
                .mockResolvedValueOnce(null);
            VerificationCode.count.mockResolvedValue(0);
            VerificationCode.findOne.mockResolvedValue(null);
            VerificationCode.create.mockResolvedValue({});

            await verifyCommand.execute(interaction, context);

            expect(context.log.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: 'guild123',
                    generatorId: 'user123',
                    roleId: 'role123',
                }),
                'Verification code generated',
            );
        });
    });

    describe('autocomplete', () => {
        beforeEach(() => {
            interaction.options.getFocused = jest.fn().mockReturnValue('');
        });

        it('should return empty if no guildId', async () => {
            interaction.guildId = null;

            await verifyCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('should return empty if no member', async () => {
            interaction.member = null;

            await verifyCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('should return empty if no allowed roles configured', async () => {
            Config.findOne.mockResolvedValue(null);

            await verifyCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('should filter roles by search term', async () => {
            Config.findOne.mockResolvedValue({ value: JSON.stringify(['role123']) });
            interaction.options.getFocused.mockReturnValue('test');

            await verifyCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([
                { name: 'Test Role', value: 'role123' },
            ]);
        });

        it('should return empty when search does not match', async () => {
            Config.findOne.mockResolvedValue({ value: JSON.stringify(['role123']) });
            interaction.options.getFocused.mockReturnValue('xyz');

            await verifyCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
        });

        it('should handle errors gracefully', async () => {
            Config.findOne.mockRejectedValue(new Error('Database error'));

            await verifyCommand.autocomplete(interaction, context);

            expect(interaction.respond).toHaveBeenCalledWith([]);
            expect(context.log.error).toHaveBeenCalled();
        });

        it('should limit results to 25', async () => {
            const manyRoles = Array.from({ length: 30 }, (_, i) => ({
                id: `role${i}`,
                name: `Role ${i}`,
            }));
            const roleCache = new Map(manyRoles.map(r => [r.id, r]));

            interaction.member.roles.cache = {
                has: (id: string) => roleCache.has(id),
                get: (id: string) => roleCache.get(id),
                map: (fn: any) => Array.from(roleCache.values()).map(fn),
                filter: (fn: any) => {
                    const filtered = Array.from(roleCache.values()).filter(fn);
                    return {
                        map: (mapFn: any) => filtered.map(mapFn),
                        slice: (start: number, end: number) => filtered.slice(start, end),
                    };
                },
            };

            Config.findOne.mockResolvedValue({
                value: JSON.stringify(manyRoles.map(r => r.id)),
            });
            interaction.options.getFocused.mockReturnValue('role');

            await verifyCommand.autocomplete(interaction, context);

            const response = (interaction.respond as jest.Mock).mock.calls[0][0];
            expect(response.length).toBeLessThanOrEqual(25);
        });
    });
});
