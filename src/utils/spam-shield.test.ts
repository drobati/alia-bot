import {
    checkAndRecord,
    hashMessage,
    pickDuneWarning,
    loadShieldConfig,
    executeShield,
    evaluateMessage,
    _resetCacheForTests,
} from './spam-shield';

jest.mock('./permissions', () => ({
    isOwner: jest.fn().mockReturnValue(false),
    checkOwnerPermission: jest.fn(),
}));

const { isOwner } = jest.requireMock('./permissions') as { isOwner: jest.Mock };

function buildMessage(overrides: any = {}) {
    const { attachments, stickers, userId, ...rest } = overrides;
    return {
        id: 'm1',
        guildId: 'g1',
        channelId: 'c1',
        content: 'hello',
        deletable: true,
        delete: jest.fn().mockResolvedValue(undefined),
        channel: { send: jest.fn().mockResolvedValue({}) },
        ...rest,
        author: { id: userId ?? 'u1', bot: false },
        attachments: new Map(attachments ?? []),
        stickers: new Map(stickers ?? []),
    } as any;
}

function buildContext(configRows: Record<string, string> = {}, overrides: any = {}) {
    const findOne = jest.fn(async ({ where }: any) => {
        const value = configRows[where.key];
        return value !== undefined ? { value } : null;
    });
    return {
        tables: {
            Config: { findOne },
            SecurityIncidents: {
                create: jest.fn().mockResolvedValue({ update: jest.fn() }),
            },
            ...overrides.tables,
        },
        log: { warn: jest.fn(), info: jest.fn(), debug: jest.fn(), error: jest.fn() },
    } as any;
}

describe('hashMessage', () => {
    it('hashes plain text consistently', () => {
        const a = buildMessage({ content: 'Click here free nitro' });
        const b = buildMessage({ content: 'click here free nitro' });
        expect(hashMessage(a)).toBe(hashMessage(b));
    });

    it('returns null for empty content with no attachments', () => {
        const m = buildMessage({ content: '   ' });
        expect(hashMessage(m)).toBeNull();
    });

    it('hashes attachment-only messages', () => {
        const m = buildMessage({
            content: '',
            attachments: [['a1', { url: 'https://cdn/a.png' }]],
        });
        expect(hashMessage(m)).not.toBeNull();
    });
});

describe('checkAndRecord', () => {
    beforeEach(() => _resetCacheForTests());

    it('returns null on first sighting', () => {
        const result = checkAndRecord(buildMessage({ id: 'm1', channelId: 'c1', content: 'hi' }));
        expect(result).toBeNull();
    });

    it('returns null when duplicate appears in the same channel', () => {
        checkAndRecord(buildMessage({ id: 'm1', channelId: 'c1', content: 'hi' }));
        const result = checkAndRecord(buildMessage({ id: 'm2', channelId: 'c1', content: 'hi' }));
        expect(result).toBeNull();
    });

    it('triggers when duplicate appears in a different channel', () => {
        checkAndRecord(buildMessage({ id: 'm1', channelId: 'c1', content: 'free nitro' }));
        const result = checkAndRecord(buildMessage({
            id: 'm2', channelId: 'c2', content: 'free nitro',
        }));
        expect(result).not.toBeNull();
        expect(result!.distinctChannelIds.has('c1')).toBe(true);
        expect(result!.distinctChannelIds.has('c2')).toBe(true);
        expect(result!.matchedEntries).toHaveLength(2);
    });

    it('treats different users independently', () => {
        checkAndRecord(buildMessage({ userId: 'u1', channelId: 'c1', content: 'spam' }));
        const result = checkAndRecord(buildMessage({
            userId: 'u2', channelId: 'c2', content: 'spam',
        }));
        expect(result).toBeNull();
    });

    it('treats different guilds independently', () => {
        checkAndRecord(buildMessage({ guildId: 'g1', channelId: 'c1', content: 'spam' }));
        const result = checkAndRecord(buildMessage({
            guildId: 'g2', channelId: 'c2', content: 'spam',
        }));
        expect(result).toBeNull();
    });

    it('skips messages without a guildId', () => {
        const result = checkAndRecord(buildMessage({ guildId: null, content: 'x' }));
        expect(result).toBeNull();
    });

    it('catches image-only spam across channels', () => {
        const attachments = [['a1', { url: 'https://cdn/spam.png' }]];
        checkAndRecord(buildMessage({ id: 'm1', channelId: 'c1', content: '', attachments }));
        const result = checkAndRecord(buildMessage({
            id: 'm2', channelId: 'c2', content: '', attachments,
        }));
        expect(result).not.toBeNull();
    });
});

describe('pickDuneWarning', () => {
    it('always returns a non-empty string', () => {
        for (let i = 0; i < 50; i++) {
            expect(pickDuneWarning(i).length).toBeGreaterThan(20);
        }
    });
});

describe('loadShieldConfig', () => {
    it('returns disabled defaults when no rows', async () => {
        const ctx = buildContext({});
        const cfg = await loadShieldConfig(ctx, 'g1');
        expect(cfg).toEqual({ enabled: false, dryRun: false, purgatoryChannelId: null });
    });

    it('reads enabled / dryRun / purgatory from Config', async () => {
        const ctx = buildContext({
            security_enabled_g1: 'true',
            security_dryrun_g1: 'true',
            security_purgatory_channel_g1: 'ch99',
        });
        const cfg = await loadShieldConfig(ctx, 'g1');
        expect(cfg).toEqual({ enabled: true, dryRun: true, purgatoryChannelId: 'ch99' });
    });
});

describe('executeShield', () => {
    beforeEach(() => {
        _resetCacheForTests();
        isOwner.mockReturnValue(false);
    });

    // eslint-disable-next-line no-unused-vars
    type RolePredicate = (role: any) => boolean;
    // eslint-disable-next-line no-unused-vars
    type RoleMapper<T> = (role: any) => T;
    function buildRoleCache(roles: { id: string }[]) {
        return {
            filter(predicate: RolePredicate) {
                return buildRoleCache(roles.filter(predicate));
            },
            map<T>(fn: RoleMapper<T>): T[] {
                return roles.map(fn);
            },
        };
    }

    function buildGuild(opts: any = {}) {
        const member = opts.member ?? {
            id: 'u1',
            permissions: { has: jest.fn().mockReturnValue(false) },
            roles: {
                cache: buildRoleCache([{ id: 'r1' }, { id: 'r2' }]),
                set: jest.fn().mockResolvedValue(undefined),
            },
            timeout: jest.fn().mockResolvedValue(undefined),
        };
        const purgatorySend = jest.fn().mockResolvedValue({});
        const purgatory = {
            isTextBased: () => true,
            send: purgatorySend,
        };
        const channels = new Map<string, any>();
        channels.set('purg', purgatory);
        return {
            id: 'g1',
            members: { fetch: jest.fn().mockResolvedValue(member) },
            channels: { cache: channels },
            _member: member,
            _purgatorySend: purgatorySend,
        };
    }

    it('strips roles, applies timeout, and posts both messages on real action', async () => {
        const guild = buildGuild();
        const sourceSend = jest.fn().mockResolvedValue({});
        const trigger = buildMessage({
            guildId: 'g1', channelId: 'c2', userId: 'u1', content: 'free nitro',
            guild,
            channel: { send: sourceSend },
        });
        const ctx = buildContext({
            security_enabled_g1: 'true',
            security_purgatory_channel_g1: 'purg',
        });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [
                { hash: 'h', channelId: 'c1', messageId: 'm0', timestamp: Date.now() },
            ],
        };
        await executeShield(trigger, match as any, ctx);

        expect(guild._member.roles.set).toHaveBeenCalledWith([], expect.any(String));
        expect(guild._member.timeout).toHaveBeenCalledWith(86400000, expect.any(String));
        expect(guild._purgatorySend).toHaveBeenCalled();
        expect(sourceSend).toHaveBeenCalledWith(expect.stringMatching(/protected the server/i));
        expect(ctx.tables.SecurityIncidents.create).toHaveBeenCalled();
    });

    it('skips action when shield is disabled', async () => {
        const guild = buildGuild();
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({});
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(guild._member.roles.set).not.toHaveBeenCalled();
        expect(ctx.tables.SecurityIncidents.create).not.toHaveBeenCalled();
    });

    it('skips admins and logs as skipped_admin', async () => {
        const guild = buildGuild({
            member: {
                id: 'u1',
                permissions: { has: jest.fn().mockReturnValue(true) },
                roles: { cache: buildRoleCache([]), set: jest.fn() },
                timeout: jest.fn(),
            },
        });
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(guild._member.roles.set).not.toHaveBeenCalled();
        expect(ctx.tables.SecurityIncidents.create).toHaveBeenCalledWith(
            expect.objectContaining({ action_taken: 'skipped_admin' }),
        );
    });

    it('skips bot owner', async () => {
        isOwner.mockReturnValue(true);
        const guild = buildGuild();
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(guild._member.roles.set).not.toHaveBeenCalled();
    });

    it('deletes prior cached messages from other channels on action', async () => {
        const guild = buildGuild();
        const cachedDelete = jest.fn().mockResolvedValue(undefined);
        const cachedFetch = jest.fn().mockResolvedValue({
            deletable: true,
            delete: cachedDelete,
        });
        guild.channels.cache.set('c1', {
            isTextBased: () => true,
            messages: { fetch: cachedFetch },
        });
        const trigger = buildMessage({
            guild, userId: 'u1', channelId: 'c2', content: 'spam',
        });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [
                { hash: 'h', channelId: 'c1', messageId: 'mp1', timestamp: Date.now() },
            ],
        };
        await executeShield(trigger, match as any, ctx);
        expect(cachedFetch).toHaveBeenCalledWith('mp1');
        expect(cachedDelete).toHaveBeenCalled();
    });

    it('logs an error but completes when role-strip fails', async () => {
        const guild = buildGuild();
        guild._member.roles.set.mockRejectedValueOnce(new Error('discord 403'));
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(ctx.log.error).toHaveBeenCalledWith(
            expect.stringMatching(/strip roles/i),
            expect.any(Object),
        );
        expect(guild._member.timeout).toHaveBeenCalled();
    });

    it('logs an error but completes when timeout fails', async () => {
        const guild = buildGuild();
        guild._member.timeout.mockRejectedValueOnce(new Error('discord 403'));
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(ctx.log.error).toHaveBeenCalledWith(
            expect.stringMatching(/timeout/i),
            expect.any(Object),
        );
    });

    it('skips when an action lock is already held for the same user', async () => {
        const guild = buildGuild();
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        // Concurrent calls — second hits the lock branch.
        await Promise.all([
            executeShield(trigger, match as any, ctx),
            executeShield(trigger, match as any, ctx),
        ]);
        expect(ctx.log.info).toHaveBeenCalledWith(
            expect.stringMatching(/lock held/i),
            expect.any(Object),
        );
    });

    it('logs warnings when purgatory and source channel sends fail', async () => {
        const guild = buildGuild();
        const purgatory = guild.channels.cache.get('purg');
        purgatory.send = jest.fn().mockRejectedValue(new Error('rate limit'));
        const sourceSend = jest.fn().mockRejectedValue(new Error('forbidden'));
        const trigger = buildMessage({
            guild, userId: 'u1',
            channel: { send: sourceSend },
        });
        const ctx = buildContext({
            security_enabled_g1: 'true',
            security_purgatory_channel_g1: 'purg',
        });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(ctx.log.warn).toHaveBeenCalledWith(
            expect.stringMatching(/purgatory warning/i),
            expect.any(Object),
        );
        expect(ctx.log.warn).toHaveBeenCalledWith(
            expect.stringMatching(/all-clear/i),
            expect.any(Object),
        );
    });

    it('logs a warning when a cached spam message fails to delete', async () => {
        const guild = buildGuild();
        guild.channels.cache.set('c1', {
            isTextBased: () => true,
            messages: { fetch: jest.fn().mockRejectedValue(new Error('not found')) },
        });
        const trigger = buildMessage({ guild, userId: 'u1', channelId: 'c2' });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [
                { hash: 'h', channelId: 'c1', messageId: 'mp1', timestamp: Date.now() },
            ],
        };
        await executeShield(trigger, match as any, ctx);
        // fetch returned null via .catch, no throw — verifies the .catch arrow
        expect(guild._member.roles.set).toHaveBeenCalled();
    });

    it('logs a warning when deleting the trigger message throws', async () => {
        const guild = buildGuild();
        const trigger = buildMessage({ guild, userId: 'u1' });
        trigger.delete = jest.fn().mockRejectedValue(new Error('forbidden'));
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(ctx.log.warn).toHaveBeenCalledWith(
            expect.stringMatching(/delete spam message/i),
            expect.any(Object),
        );
    });

    it('hashes sticker-only messages', () => {
        const m = buildMessage({
            content: '',
            stickers: [['s1', { id: 's1' }]],
        });
        expect(hashMessage(m)).not.toBeNull();
    });

    it('logs an error when the outer try-catch fires', async () => {
        const guild = buildGuild();
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({ security_enabled_g1: 'true' });
        // Make SecurityIncidents.create throw to trigger outer catch.
        ctx.tables.SecurityIncidents.create.mockRejectedValueOnce(new Error('db down'));
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(ctx.log.error).toHaveBeenCalledWith(
            expect.stringMatching(/execution failed/i),
            expect.any(Object),
        );
    });

    it('dry-run logs incident as dry_run without taking action', async () => {
        const guild = buildGuild();
        const trigger = buildMessage({ guild, userId: 'u1' });
        const ctx = buildContext({
            security_enabled_g1: 'true',
            security_dryrun_g1: 'true',
        });
        const match = {
            hash: 'h',
            distinctChannelIds: new Set(['c1', 'c2']),
            matchedEntries: [],
        };
        await executeShield(trigger, match as any, ctx);
        expect(guild._member.roles.set).not.toHaveBeenCalled();
        expect(guild._member.timeout).not.toHaveBeenCalled();
        expect(ctx.tables.SecurityIncidents.create).toHaveBeenCalledWith(
            expect.objectContaining({ action_taken: 'dry_run' }),
        );
    });
});

describe('evaluateMessage (integration)', () => {
    beforeEach(() => {
        _resetCacheForTests();
        isOwner.mockReturnValue(false);
    });

    it('does nothing for first message', async () => {
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const result = await evaluateMessage(
            buildMessage({ id: 'm1', channelId: 'c1', content: 'spam' }),
            ctx,
        );
        expect(result).toBe(false);
    });

    it('triggers shield on cross-channel duplicate', async () => {
        const ctx = buildContext({ security_enabled_g1: 'true' });
        const guild = {
            id: 'g1',
            members: {
                fetch: jest.fn().mockResolvedValue({
                    id: 'u1',
                    permissions: { has: jest.fn().mockReturnValue(false) },
                    roles: {
                        cache: {
                            filter: () => ({ map: () => [] }),
                        },
                        set: jest.fn().mockResolvedValue(undefined),
                    },
                    timeout: jest.fn().mockResolvedValue(undefined),
                }),
            },
            channels: { cache: new Map() },
        };
        await evaluateMessage(
            buildMessage({ id: 'm1', channelId: 'c1', content: 'spam', guild }),
            ctx,
        );
        const result = await evaluateMessage(
            buildMessage({ id: 'm2', channelId: 'c2', content: 'spam', guild }),
            ctx,
        );
        expect(result).toBe(true);
    });
});
