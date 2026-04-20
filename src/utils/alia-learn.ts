import { Context } from './types';

/**
 * Auto-learn pipeline. Alia is instructed to embed machine-readable markers in
 * her replies when a user asks her to remember a fact:
 *
 *   <REMEMBER user_id="123" description="a badass guitarist"/>
 *
 * We extract these markers, persist them to UserDescriptions, and strip them
 * from the text that gets sent to Discord. The marker approach avoids the
 * complexity of multi-turn tool calls and works on any model.
 */

export interface RememberMarker {
    userId: string;
    description: string;
}

export interface ParseResult {
    markers: RememberMarker[];
    cleaned: string;
}

const MARKER_RE = /<REMEMBER\s+user_id="([^"]+)"\s+description="([^"]+)"\s*\/?\s*>/gi;
const MAX_DESCRIPTION_LENGTH = 200;

export function parseRememberMarkers(text: string): ParseResult {
    const markers: RememberMarker[] = [];
    const cleaned = text.replace(MARKER_RE, (_match, userId: string, description: string) => {
        const trimmed = description.trim();
        if (trimmed.length > 0 && trimmed.length <= MAX_DESCRIPTION_LENGTH) {
            markers.push({ userId: userId.trim(), description: trimmed });
        }
        return '';
    }).replace(/\s+/g, ' ').trim();
    return { markers, cleaned };
}

export async function persistMarkers(
    context: Context,
    markers: RememberMarker[],
    guildId: string,
    creatorId: string,
    allowedUserIds: Set<string>,
): Promise<number> {
    if (markers.length === 0) {return 0;}
    const { tables, log } = context;
    let saved = 0;
    for (const marker of markers) {
        if (!allowedUserIds.has(marker.userId)) {
            log.warn('Rejected auto-learn marker for non-conversation user', {
                userId: marker.userId,
                description: marker.description,
            });
            continue;
        }
        try {
            await tables.UserDescriptions.findOrCreate({
                where: {
                    guild_id: guildId,
                    user_id: marker.userId,
                    description: marker.description,
                },
                defaults: {
                    guild_id: guildId,
                    user_id: marker.userId,
                    description: marker.description,
                    creator_id: creatorId,
                },
            });
            saved += 1;
        } catch (error) {
            log.warn('Failed to persist auto-learn marker', { error, marker });
        }
    }
    return saved;
}
