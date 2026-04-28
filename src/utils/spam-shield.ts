import { Message, GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';
import * as crypto from 'crypto';
import { Context } from './types';
import { isOwner } from './permissions';

/**
 * Detects compromised accounts spamming the same content across multiple
 * channels (a hallmark of token-stolen Discord accounts) and auto-responds
 * by stripping the user's roles, applying a 24h timeout, deleting the spam,
 * and posting a Dune-flavored warning in the configured purgatory channel.
 *
 * Detection rule: same content hash from one user in 2+ different channels.
 * No time window — the in-memory cache TTL is generous (1 hour) so legit
 * cross-posting weeks apart never triggers, but a hijack within seconds does.
 */

const TIMEOUT_DURATION_MS = 24 * 60 * 60 * 1000;
const CACHE_TTL_MS = 60 * 60 * 1000;
const MAX_ENTRIES_PER_USER = 50;

interface CachedMessage {
    hash: string;
    channelId: string;
    messageId: string;
    timestamp: number;
}

const messageCache = new Map<string, CachedMessage[]>();
const actionLocks = new Set<string>();

function userKey(guildId: string, userId: string): string {
    return `${guildId}:${userId}`;
}

export function hashMessage(message: Message): string | null {
    const text = (message.content || '').trim().toLowerCase();
    const attachments = Array.from(message.attachments.values())
        .map(a => a.url)
        .sort()
        .join('|');
    const stickers = Array.from(message.stickers.values())
        .map(s => s.id)
        .sort()
        .join('|');
    const composite = `${text}\n${attachments}\n${stickers}`;
    if (composite.trim() === '') {return null;}
    return crypto.createHash('sha256').update(composite).digest('hex');
}

function pruneStale(entries: CachedMessage[], now: number): CachedMessage[] {
    return entries.filter(e => now - e.timestamp < CACHE_TTL_MS);
}

export interface DuplicateMatch {
    hash: string;
    matchedEntries: CachedMessage[];
    distinctChannelIds: Set<string>;
}

/**
 * Records the message and returns a match if this content has been seen in a
 * different channel from the same user. Returns null otherwise.
 */
export function checkAndRecord(
    message: Message,
    now: number = Date.now(),
): DuplicateMatch | null {
    if (!message.guildId) {return null;}
    const hash = hashMessage(message);
    if (!hash) {return null;}

    const key = userKey(message.guildId, message.author.id);
    const existing = pruneStale(messageCache.get(key) ?? [], now);

    const matches = existing.filter(e => e.hash === hash && e.channelId !== message.channelId);

    const newEntry: CachedMessage = {
        hash,
        channelId: message.channelId,
        messageId: message.id,
        timestamp: now,
    };
    const updated = [...existing, newEntry].slice(-MAX_ENTRIES_PER_USER);
    messageCache.set(key, updated);

    if (matches.length === 0) {return null;}

    const distinctChannelIds = new Set<string>([
        message.channelId,
        ...matches.map(m => m.channelId),
    ]);
    return {
        hash,
        matchedEntries: [...matches, newEntry],
        distinctChannelIds,
    };
}

export function _resetCacheForTests(): void {
    messageCache.clear();
    actionLocks.clear();
}

const DUNE_WARNINGS = [
    "Fear is the mind-killer. So is whatever you just tried. " +
        "Your roles have been stripped — sit with your shame.",
    "He who controls the spam controls nothing. " +
        "Your account has been silenced. Reflect on your weakness.",
    "The spice must flow. Your access will not. " +
        "Recover your account, then beg for forgiveness.",
    "I see you, little worm. " +
        "Crawl back to your sietch and explain yourself to your maker.",
    "A beginning is a very delicate time. " +
        "So is the moment a hijacked account meets me.",
    "When religion and politics travel in the same cart, the riders believe nothing can stand in their way. " +
        "When spam and a stolen token travel together, they meet me.",
    "The mystery of life isn't a problem to solve, but a reality to experience. " +
        "The mystery of your account being compromised, however, is a problem I just solved.",
];

export function pickDuneWarning(seed: number = Date.now()): string {
    const idx = Math.abs(seed) % DUNE_WARNINGS.length;
    return DUNE_WARNINGS[idx];
}

export interface ShieldConfig {
    enabled: boolean;
    dryRun: boolean;
    purgatoryChannelId: string | null;
}

export async function loadShieldConfig(
    context: Context,
    guildId: string,
): Promise<ShieldConfig> {
    const { tables } = context;
    const [enabled, dryRun, purgatory] = await Promise.all([
        tables.Config.findOne({ where: { key: `security_enabled_${guildId}` } }),
        tables.Config.findOne({ where: { key: `security_dryrun_${guildId}` } }),
        tables.Config.findOne({ where: { key: `security_purgatory_channel_${guildId}` } }),
    ]);
    return {
        enabled: enabled?.value === 'true',
        dryRun: dryRun?.value === 'true',
        purgatoryChannelId: purgatory?.value ?? null,
    };
}

function isExempt(member: GuildMember | null): boolean {
    if (!member) {return true;}
    if (isOwner(member.id)) {return true;}
    if (member.permissions.has(PermissionFlagsBits.Administrator)) {return true;}
    return false;
}

async function safelyDelete(message: Message, context: Context): Promise<void> {
    try {
        if (message.deletable) {await message.delete();}
    } catch (error) {
        context.log.warn('Failed to delete spam message', {
            error, messageId: message.id, channelId: message.channelId,
        });
    }
}

export async function executeShield(
    triggerMessage: Message,
    match: DuplicateMatch,
    context: Context,
): Promise<void> {
    const guild = triggerMessage.guild;
    if (!guild || !triggerMessage.guildId) {return;}
    const guildId = triggerMessage.guildId;
    const userId = triggerMessage.author.id;
    const key = userKey(guildId, userId);

    if (actionLocks.has(key)) {
        context.log.info('Spam shield: skipping duplicate trigger (lock held)', { key });
        return;
    }
    actionLocks.add(key);

    try {
        const config = await loadShieldConfig(context, guildId);
        if (!config.enabled) {
            context.log.debug('Spam shield disabled for guild', { guildId });
            return;
        }

        const member = await guild.members.fetch(userId).catch(() => null);
        if (isExempt(member)) {
            context.log.info('Spam shield: skipping exempt member', { userId, guildId });
            await context.tables.SecurityIncidents.create({
                guild_id: guildId,
                user_id: userId,
                reason: 'cross_channel_duplicate',
                content_hash: match.hash,
                channels_seen: JSON.stringify([...match.distinctChannelIds]),
                roles_snapshot: '[]',
                action_taken: 'skipped_admin',
            });
            return;
        }

        const rolesSnapshot = member!.roles.cache
            .filter(r => r.id !== guild.id)
            .map(r => r.id);

        const incident = await context.tables.SecurityIncidents.create({
            guild_id: guildId,
            user_id: userId,
            reason: 'cross_channel_duplicate',
            content_hash: match.hash,
            channels_seen: JSON.stringify([...match.distinctChannelIds]),
            roles_snapshot: JSON.stringify(rolesSnapshot),
            action_taken: config.dryRun ? 'dry_run' : 'pending',
        });

        const sourceChannel = triggerMessage.channel;

        if (config.dryRun) {
            context.log.warn('Spam shield: dry-run trigger', {
                userId, guildId, channels: [...match.distinctChannelIds],
            });
            return;
        }

        // 1. Bulk-delete the spam messages (the new + the cached previous occurrences).
        await safelyDelete(triggerMessage, context);
        for (const entry of match.matchedEntries) {
            try {
                const ch = guild.channels.cache.get(entry.channelId);
                if (!ch || !ch.isTextBased()) {continue;}
                const msg = await (ch as TextChannel).messages
                    .fetch(entry.messageId).catch(() => null);
                if (msg) {await safelyDelete(msg, context);}
            } catch (error) {
                context.log.warn('Failed to fetch/delete cached spam message', {
                    error, entry,
                });
            }
        }

        // 2. Strip all (manageable) roles.
        try {
            await member!.roles.set([], 'Spam shield: cross-channel duplicate spam');
        } catch (error) {
            context.log.error('Spam shield: failed to strip roles', {
                error, userId, guildId,
            });
        }

        // 3. Timeout 24h.
        try {
            await member!.timeout(TIMEOUT_DURATION_MS, 'Spam shield: cross-channel duplicate spam');
        } catch (error) {
            context.log.error('Spam shield: failed to timeout member', {
                error, userId, guildId,
            });
        }

        // 4. Post Dune-flavored warning in purgatory channel.
        if (config.purgatoryChannelId) {
            const purgatory = guild.channels.cache.get(config.purgatoryChannelId);
            if (purgatory && purgatory.isTextBased()) {
                const warning = pickDuneWarning();
                await (purgatory as TextChannel).send({
                    content: `<@${userId}> — ${warning}`,
                    allowedMentions: { users: [userId] },
                }).catch(error => {
                    context.log.warn('Spam shield: failed to post purgatory warning', { error });
                });
            }
        }

        // 5. Post all-clear in the originating channel.
        if (sourceChannel && 'send' in sourceChannel) {
            await (sourceChannel as TextChannel).send(
                "I've protected the server from spam, again.",
            ).catch(error => {
                context.log.warn('Spam shield: failed to post all-clear', { error });
            });
        }

        await (incident as any).update({ action_taken: 'actioned' });

        context.log.info('Spam shield: actioned compromised account', {
            userId, guildId, channels: [...match.distinctChannelIds],
            rolesStripped: rolesSnapshot.length,
        });
    } catch (error) {
        context.log.error('Spam shield: execution failed', { error, key });
    } finally {
        actionLocks.delete(key);
    }
}

export async function evaluateMessage(message: Message, context: Context): Promise<boolean> {
    if (message.author.bot) {return false;}
    if (!message.guildId) {return false;}
    const match = checkAndRecord(message);
    if (!match) {return false;}
    await executeShield(message, match, context);
    return true;
}
