import { Message } from 'discord.js';
import { Context } from './types';
import { getHistory, HistoryEntry } from './conversation-history';

export interface MentionedUserContext {
    displayName: string;
    descriptions: string[];
}

export interface AliaExtraContext {
    speakerDescriptions: string[];
    mentionedUsers: MentionedUserContext[];
    relevantMemories: { key: string; value: string }[];
    history: HistoryEntry[];
}

const MAX_DESCRIPTIONS_PER_USER = 5;
const MAX_RELEVANT_MEMORIES = 4;
const MEMORY_FETCH_LIMIT = 500;
const MIN_MEMORY_KEY_LENGTH = 3;

async function fetchDescriptions(
    tables: Context['tables'],
    guildId: string,
    userId: string,
): Promise<string[]> {
    const rows = await tables.UserDescriptions.findAll({
        where: { guild_id: guildId, user_id: userId },
        limit: MAX_DESCRIPTIONS_PER_USER,
    });
    return rows.map((r: any) => r.description);
}

async function findRelevantMemories(
    tables: Context['tables'],
    messageContent: string,
): Promise<{ key: string; value: string }[]> {
    const haystack = messageContent.toLowerCase();
    const memories = await tables.Memories.findAll({ limit: MEMORY_FETCH_LIMIT });
    const matches: { key: string; value: string }[] = [];
    for (const mem of memories) {
        const key = (mem as any).key as string;
        if (!key || key.length < MIN_MEMORY_KEY_LENGTH) {continue;}
        if (haystack.includes(key.toLowerCase())) {
            matches.push({ key, value: (mem as any).value });
            if (matches.length >= MAX_RELEVANT_MEMORIES) {break;}
        }
    }
    return matches;
}

export async function gatherAliaContext(
    message: Message,
    context: Context,
): Promise<AliaExtraContext> {
    const { tables, log } = context;
    const guildId = message.guildId;

    const result: AliaExtraContext = {
        speakerDescriptions: [],
        mentionedUsers: [],
        relevantMemories: [],
        history: getHistory(message.channelId),
    };

    try {
        if (guildId) {
            result.speakerDescriptions = await fetchDescriptions(
                tables, guildId, message.author.id,
            );

            const mentionedIds = new Set<string>();
            message.mentions.users.forEach(u => {
                if (u.id !== message.author.id && u.id !== message.client.user?.id) {
                    mentionedIds.add(u.id);
                }
            });

            for (const userId of mentionedIds) {
                const descriptions = await fetchDescriptions(tables, guildId, userId);
                if (descriptions.length === 0) {continue;}
                const member = message.mentions.users.get(userId);
                const displayName = member?.username ?? userId;
                result.mentionedUsers.push({ displayName, descriptions });
            }
        }

        result.relevantMemories = await findRelevantMemories(tables, message.content);
    } catch (error) {
        log.warn('Failed to gather Alia context', { error });
    }

    return result;
}
