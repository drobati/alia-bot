import { Context } from './types';

export type Tier = 'stranger' | 'acquaintance' | 'regular';

export interface InteractionInfo {
    count: number;
    tier: Tier;
    lastInteractionAt: Date | null;
    hoursSinceLast: number | null;
}

const ACQUAINTANCE_THRESHOLD = 3;
const REGULAR_THRESHOLD = 20;

export function classifyTier(count: number): Tier {
    if (count < ACQUAINTANCE_THRESHOLD) {return 'stranger';}
    if (count < REGULAR_THRESHOLD) {return 'acquaintance';}
    return 'regular';
}

export async function getInteractionInfo(
    tables: Context['tables'],
    guildId: string,
    userId: string,
): Promise<InteractionInfo> {
    const row = await tables.UserInteractions.findOne({
        where: { guild_id: guildId, user_id: userId },
    });
    if (!row) {
        return { count: 0, tier: 'stranger', lastInteractionAt: null, hoursSinceLast: null };
    }
    const count = (row as any).interaction_count as number;
    const lastAt = (row as any).last_interaction_at as Date;
    const hoursSince = lastAt
        ? Math.round((Date.now() - new Date(lastAt).getTime()) / 36e5)
        : null;
    return {
        count,
        tier: classifyTier(count),
        lastInteractionAt: lastAt,
        hoursSinceLast: hoursSince,
    };
}

export async function bumpInteraction(
    tables: Context['tables'],
    guildId: string,
    userId: string,
): Promise<void> {
    const now = new Date();
    const [row, created] = await tables.UserInteractions.findOrCreate({
        where: { guild_id: guildId, user_id: userId },
        defaults: {
            guild_id: guildId,
            user_id: userId,
            interaction_count: 1,
            last_interaction_at: now,
        },
    });
    if (!created) {
        await (row as any).update({
            interaction_count: (row as any).interaction_count + 1,
            last_interaction_at: now,
        });
    }
}

export function describeRelationship(info: InteractionInfo, speakerName: string): string {
    if (info.count === 0) {
        return `You have never talked to ${speakerName} before. They're a stranger.`;
    }
    const parts = [
        `Your relationship with ${speakerName}: ${info.tier} (${info.count} prior interactions).`,
    ];
    if (info.hoursSinceLast !== null && info.hoursSinceLast < 24) {
        parts.push(`You talked with them ${info.hoursSinceLast}h ago.`);
    }
    if (info.tier === 'regular') {
        parts.push('You know them well. Feel free to be warmer, reference past vibes.');
    } else if (info.tier === 'stranger') {
        parts.push('You barely know them. Keep some distance.');
    }
    return parts.join(' ');
}
