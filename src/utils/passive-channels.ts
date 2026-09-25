import { Context } from './types';

const TTL_MS = 60_000;
/** Bounded on purpose. An unbounded per-guild cache is a slow leak. */
const MAX_GUILDS = 500;

interface Entry {
    channels: string[];
    expires: number;
}

const cache = new Map<string, Entry>();

const keyFor = (guildId: string) => `passive_qa_channels_${guildId}`;

export function clearPassiveChannelCache(): void {
    cache.clear();
}

function prune(now: number): void {
    for (const [guildId, entry] of cache) {
        if (entry.expires <= now) {
            cache.delete(guildId);
        }
    }
    while (cache.size > MAX_GUILDS) {
        const oldest = cache.keys().next().value as string | undefined;
        if (oldest === undefined) {
            break;
        }
        cache.delete(oldest);
    }
}

async function load(context: Context, guildId: string): Promise<string[]> {
    const now = Date.now();
    const cached = cache.get(guildId);
    if (cached && cached.expires > now) {
        return cached.channels;
    }

    let channels: string[] = [];
    try {
        const row = await context.tables.Config.findOne({ where: { key: keyFor(guildId) } });
        if (row?.value) {
            const parsed = JSON.parse(row.value);
            channels = Array.isArray(parsed) ? parsed.filter((c: unknown) => typeof c === 'string') : [];
        }
    } catch (error) {
        // A corrupt or unreachable config means passive answering is off, never on.
        context.log.warn('Failed to read passive channel config', { guildId, error });
        channels = [];
    }

    prune(now);
    cache.set(guildId, { channels, expires: now + TTL_MS });
    return channels;
}

export async function isPassiveChannel(
    context: Context,
    guildId: string,
    channelId: string,
): Promise<boolean> {
    return (await load(context, guildId)).includes(channelId);
}

export async function setPassiveChannel(
    context: Context,
    guildId: string,
    channelId: string,
    enabled: boolean,
): Promise<void> {
    const current = await load(context, guildId);
    const next = enabled
        ? (current.includes(channelId) ? current : [...current, channelId])
        : current.filter(id => id !== channelId);

    await context.tables.Config.upsert({ key: keyFor(guildId), value: JSON.stringify(next) });
    cache.delete(guildId);
}
