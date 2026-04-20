/**
 * Short-term per-channel conversation memory for Alia.
 *
 * Keeps the last few messages (from any user plus Alia's replies) in a
 * channel so Alia can follow the thread. Entries expire after a short TTL
 * so stale context doesn't leak into unrelated conversations later.
 */

export interface HistoryEntry {
    role: 'user' | 'assistant';
    username: string;
    content: string;
    timestamp: number;
}

interface ChannelHistory {
    entries: HistoryEntry[];
    lastTouched: number;
}

const MAX_ENTRIES = 6;
const TTL_MS = 5 * 60 * 1000;

const channels = new Map<string, ChannelHistory>();

function prune(now: number): void {
    for (const [channelId, hist] of channels) {
        if (now - hist.lastTouched > TTL_MS) {
            channels.delete(channelId);
        }
    }
}

export function recordMessage(
    channelId: string,
    role: HistoryEntry['role'],
    username: string,
    content: string,
    now: number = Date.now(),
): void {
    prune(now);
    const hist = channels.get(channelId) ?? { entries: [], lastTouched: now };
    hist.entries.push({ role, username, content, timestamp: now });
    if (hist.entries.length > MAX_ENTRIES) {
        hist.entries.splice(0, hist.entries.length - MAX_ENTRIES);
    }
    hist.lastTouched = now;
    channels.set(channelId, hist);
}

export function getHistory(channelId: string, now: number = Date.now()): HistoryEntry[] {
    prune(now);
    const hist = channels.get(channelId);
    if (!hist) {return [];}
    return [...hist.entries];
}

export function clearHistory(channelId: string): void {
    channels.delete(channelId);
}

export function _resetForTests(): void {
    channels.clear();
}
