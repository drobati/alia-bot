import { createContext, createTable } from "../utils/testHelpers";
import verification from "./verification";

describe('responses/verification', () => {
    let context: any;
    let message: any;
    let Config: any;
    let VerificationCode: any;

    // Helper to set up a complete mock scenario
    function setupMocks(options: {
        welcomeChannelId?: string | null;
        expirationSeconds?: string | null;
        logChannelId?: string | null;
        verificationCode?: any;
    }) {
        Config.findOne.mockReset();

        // Mock welcome channel lookup
        if (options.welcomeChannelId) {
            Config.findOne.mockImplementation(({ where }: any) => {
                if (where.key.startsWith('welcome_channel_')) {
                    return Promise.resolve({ value: options.welcomeChannelId });
                }
                if (where.key.startsWith('verify_expiration_')) {
                    return Promise.resolve(
                        options.expirationSeconds ? { value: options.expirationSeconds } : null,
                    );
                }
                if (where.key.startsWith('verify_log_channel_')) {
                    return Promise.resolve(
                        options.logChannelId ? { value: options.logChannelId } : null,
                    );
                }
                return Promise.resolve(null);
            });
        } else {
            Config.findOne.mockResolvedValue(null);
        }

        if (options.verificationCode) {
            VerificationCode.findOne.mockResolvedValue(options.verificationCode);
        } else {
            VerificationCode.findOne.mockResolvedValue(null);
        }
    }

    beforeEach(() => {
        context = createContext();
        Config = createTable();
        VerificationCode = createTable();
        context.tables.Config = Config;
        context.tables.VerificationCode = VerificationCode;

        // Mock guild and channel
        const mockRole = { id: 'role123', name: 'Test Role' };
        const mockLogChannel = {
            isTextBased: jest.fn().mockReturnValue(true),
            send: jest.fn().mockResolvedValue({}),
        };

        message = {
            content: 'V-ABC234',  // Note: Uses valid chars (no 0, 1, O, I, L)
            guild: {
                id: 'guild123',
                roles: {
                    cache: new Map([['role123', mockRole]]),
                },
                channels: {
                    cache: new Map([['logchan123', mockLogChannel]]),
                },
            },
            guildId: 'guild123',
            channelId: 'welcome123',
            author: { id: 'newuser123' },
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

            const result = await verification(message, context);

            expect(result).toBe(false);
        });

        it('should return false if not in welcome channel', async () => {
            setupMocks({ welcomeChannelId: 'different-channel' });

            const result = await verification(message, context);

            expect(result).toBe(false);
        });

        it('should return false if no welcome channel configured', async () => {
            setupMocks({ welcomeChannelId: null });

            const result = await verification(message, context);

            expect(result).toBe(false);
        });

        it('should return false if message does not contain verification code', async () => {
            message.content = 'Hello world';
            setupMocks({ welcomeChannelId: 'welcome123' });

            const result = await verification(message, context);

            expect(result).toBe(false);
        });

        it('should match verification code pattern case-insensitively', async () => {
            message.content = 'v-abc234'; // lowercase - valid chars
            setupMocks({ welcomeChannelId: 'welcome123' });

            const result = await verification(message, context);

            expect(result).toBe(false);
            expect(VerificationCode.findOne).toHaveBeenCalled();
        });
    });

    describe('code validation', () => {
        it('should return false for invalid/expired code silently', async () => {
            setupMocks({ welcomeChannelId: 'welcome123', verificationCode: null });

            const result = await verification(message, context);

            expect(result).toBe(false);
        });

        it('should return false if member not found', async () => {
            message.member = null;
            setupMocks({
                welcomeChannelId: 'welcome123',
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });

            const result = await verification(message, context);

            expect(result).toBe(false);
        });

        it('should return false if user already has the role', async () => {
            message.member.roles.cache = new Map([['role123', { id: 'role123' }]]);
            setupMocks({
                welcomeChannelId: 'welcome123',
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });

            const result = await verification(message, context);

            expect(result).toBe(false);
        });

        it('should return false if role not found in guild', async () => {
            message.guild.roles.cache = new Map(); // Empty roles
            setupMocks({
                welcomeChannelId: 'welcome123',
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });

            const result = await verification(message, context);

            expect(result).toBe(false);
            expect(context.log.error).toHaveBeenCalled();
        });
    });

    describe('successful verification', () => {
        beforeEach(() => {
            setupMocks({
                welcomeChannelId: 'welcome123',
                logChannelId: 'logchan123',
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });
            VerificationCode.update.mockResolvedValue([1]);
        });

        it('should grant role to member', async () => {
            const result = await verification(message, context);

            expect(result).toBe(true);
            expect(message.member.roles.add).toHaveBeenCalledWith(
                expect.objectContaining({ id: 'role123' }),
            );
        });

        it('should mark code as used', async () => {
            await verification(message, context);

            expect(VerificationCode.update).toHaveBeenCalledWith(
                expect.objectContaining({
                    used: true,
                    usedBy: 'newuser123',
                }),
                expect.objectContaining({
                    where: { code: 'V-ABC234' },
                }),
            );
        });

        it('should delete the message', async () => {
            await verification(message, context);

            expect(message.delete).toHaveBeenCalled();
        });

        it('should log to log channel if configured', async () => {
            await verification(message, context);

            const logChannel = message.guild.channels.cache.get('logchan123');
            expect(logChannel.send).toHaveBeenCalledWith(
                expect.stringContaining('V-ABC234'),
            );
        });

        it('should log successful verification', async () => {
            await verification(message, context);

            expect(context.log.info).toHaveBeenCalledWith(
                expect.objectContaining({
                    code: 'V-ABC234',
                    userId: 'newuser123',
                    generatorId: 'generator123',
                    roleId: 'role123',
                }),
                'Verification code used successfully',
            );
        });
    });

    describe('error handling', () => {
        it('should handle message deletion failure gracefully', async () => {
            setupMocks({
                welcomeChannelId: 'welcome123',
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });
            VerificationCode.update.mockResolvedValue([1]);
            message.delete.mockRejectedValue(new Error('Cannot delete'));

            const result = await verification(message, context);

            expect(result).toBe(true);
            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(Error) }),
                'Failed to delete verification message',
            );
        });

        it('should handle log channel send failure gracefully', async () => {
            setupMocks({
                welcomeChannelId: 'welcome123',
                logChannelId: 'logchan123',
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });
            VerificationCode.update.mockResolvedValue([1]);

            const logChannel = message.guild.channels.cache.get('logchan123');
            logChannel.send.mockRejectedValue(new Error('Cannot send'));

            const result = await verification(message, context);

            expect(result).toBe(true);
            expect(context.log.warn).toHaveBeenCalledWith(
                expect.objectContaining({ error: expect.any(Error) }),
                'Failed to send verification log message',
            );
        });

        it('should handle database errors gracefully', async () => {
            setupMocks({ welcomeChannelId: 'welcome123' });
            VerificationCode.findOne.mockRejectedValue(new Error('Database error'));

            const result = await verification(message, context);

            expect(result).toBe(false);
            expect(context.log.error).toHaveBeenCalled();
        });

        it('should skip log channel if not configured', async () => {
            setupMocks({
                welcomeChannelId: 'welcome123',
                logChannelId: null,
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });
            VerificationCode.update.mockResolvedValue([1]);

            const result = await verification(message, context);

            expect(result).toBe(true);
            const logChannel = message.guild.channels.cache.get('logchan123');
            expect(logChannel.send).not.toHaveBeenCalled();
        });

        it('should skip log channel if channel not found', async () => {
            setupMocks({
                welcomeChannelId: 'welcome123',
                logChannelId: 'nonexistent',
                verificationCode: {
                    code: 'V-ABC234',
                    roleId: 'role123',
                    generatorId: 'generator123',
                },
            });
            VerificationCode.update.mockResolvedValue([1]);

            const result = await verification(message, context);

            expect(result).toBe(true);
        });
    });

    describe('code pattern matching', () => {
        it('should match code at start of message', async () => {
            message.content = 'V-ABC234 hello';
            setupMocks({ welcomeChannelId: 'welcome123' });

            await verification(message, context);

            expect(VerificationCode.findOne).toHaveBeenCalled();
        });

        it('should match code at end of message', async () => {
            message.content = 'hello V-ABC234';
            setupMocks({ welcomeChannelId: 'welcome123' });

            await verification(message, context);

            expect(VerificationCode.findOne).toHaveBeenCalled();
        });

        it('should match code in middle of message', async () => {
            message.content = 'hi V-ABC234 there';
            setupMocks({ welcomeChannelId: 'welcome123' });

            await verification(message, context);

            expect(VerificationCode.findOne).toHaveBeenCalled();
        });

        it('should not match invalid code format', async () => {
            message.content = 'V-ABC'; // Too short
            setupMocks({ welcomeChannelId: 'welcome123' });

            const result = await verification(message, context);

            expect(result).toBe(false);
            expect(VerificationCode.findOne).not.toHaveBeenCalled();
        });

        it('should not match code without prefix', async () => {
            message.content = 'ABC123';
            setupMocks({ welcomeChannelId: 'welcome123' });

            const result = await verification(message, context);

            expect(result).toBe(false);
        });
    });
});
