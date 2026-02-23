import { createContext, createTable } from "../utils/testHelpers";
import password from "./password";

describe('responses/password', () => {
    let context: any;
    let message: any;
    let Password: any;

    beforeEach(() => {
        context = createContext();
        Password = createTable();
        context.tables.Password = Password;
        // Mock Config table for getLogChannel helper
        context.tables.Config = createTable();
        context.tables.Config.findOne.mockResolvedValue(null);

        const mockRole = { id: 'role123', name: 'Test Role' };
        const mockBotMember = { id: 'bot123' };
        const mockLogChannel = {
            isTextBased: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({}),
            permissionsFor: jest.fn().mockReturnValue({
                has: jest.fn().mockReturnValue(true),
            }),
        };

        message = {
            content: 'secretpassword',
            guild: {
                id: 'guild123',
                roles: {
                    cache: new Map([['role123', mockRole]]),
                },
                channels: {
                    cache: new Map([['logchan123', mockLogChannel]]),
                },
                members: {
                    me: mockBotMember,
                },
            },
            guildId: 'guild123',
            channelId: 'chan123',
            author: { id: 'user123' },
            member: {
                roles: {
                    cache: new Map(),
                    add: jest.fn().mockResolvedValue({}),
                },
            },
            delete: jest.fn().mockResolvedValue({}),
        };
    });

    describe('message validation', () => {
        it('should return false if not in a guild', async () => {
            message.guild = null;
            message.guildId = null;

            const result = await password(message, context);

            expect(result).toBe(false);
        });

        it('should return false if no active rules for channel', async () => {
            Password.findAll.mockResolvedValue([]);

            const result = await password(message, context);

            expect(result).toBe(false);
        });

        it('should return false if message does not match any password', async () => {
            message.content = 'wrong password';
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);

            const result = await password(message, context);

            expect(result).toBe(false);
        });
    });

    describe('password matching', () => {
        it('should match case-insensitively', async () => {
            message.content = 'SecretPassword';
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);

            const result = await password(message, context);

            expect(result).toBe(true);
        });

        it('should trim whitespace before matching', async () => {
            message.content = '  secretpassword  ';
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);

            const result = await password(message, context);

            expect(result).toBe(true);
        });

        it('should return false if user already has the role', async () => {
            message.member.roles.cache = new Map([['role123', { id: 'role123' }]]);
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);

            const result = await password(message, context);

            expect(result).toBe(false);
        });

        it('should return false if role not found in guild', async () => {
            message.guild.roles.cache = new Map();
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);

            const result = await password(message, context);

            expect(result).toBe(false);
            expect(context.log.error).toHaveBeenCalled();
        });
    });

    describe('successful password use', () => {
        beforeEach(() => {
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);
        });

        it('should grant role to member', async () => {
            const result = await password(message, context);

            expect(result).toBe(true);
            expect(message.member.roles.add).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'role123' }),
            );
        });

        it('should delete the message', async () => {
            await password(message, context);

            expect(message.delete).toHaveBeenCalled();
        });

        it('should log successful password use', async () => {
            await password(message, context);

            expect(context.log.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    guildId: 'guild123',
                    userId: 'user123',
                    roleId: 'role123',
                }),
                'Password used successfully',
            );
        });
    });

    describe('error handling', () => {
        it('should handle message deletion failure gracefully', async () => {
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);
            message.delete.mockRejectedValue(new Error('Cannot delete'));

            const result = await password(message, context);

            expect(result).toBe(true);
            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(Error) }),
                'Failed to delete password message',
            );
        });

        it('should handle role assignment failure gracefully', async () => {
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);
            message.member.roles.add.mockRejectedValue(new Error('Missing perms'));

            const result = await password(message, context);

            expect(result).toBe(false);
            expect(context.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(Error) }),
                'Failed to assign role via password',
            );
        });

        it('should return false if member is null', async () => {
            message.member = null;
            Password.findAll.mockResolvedValue([
                { password: 'secretpassword', roleId: 'role123' },
            ]);

            const result = await password(message, context);

            expect(result).toBe(false);
        });
    });
});
