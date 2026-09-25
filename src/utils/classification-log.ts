import { Op } from 'sequelize';
import { Classification } from './question-types';
import { Context } from './types';

const MAX_CONTENT = 255;

export type LogReason = 'below_floor' | 'tool_no_answer';

export interface RecordParams {
    guildId: string;
    channelId: string;
    messageId: string;
    content: string;
    addressed: boolean;
    classification: Classification;
    route: string;
    reason: LogReason;
}

/**
 * Records a classification the floor rejected, or one whose tool could not
 * answer. A filter that discards what it rejects cannot be tuned, and the
 * runners-up are the only way to see which types competed.
 *
 * Never throws and never blocks a reply: a logging failure is a warning.
 */
export async function recordClassification(context: Context, params: RecordParams): Promise<void> {
    try {
        await context.tables.ClassificationLog.create({
            guild_id: params.guildId,
            channel_id: params.channelId,
            message_id: params.messageId,
            content: params.content.slice(0, MAX_CONTENT),
            addressed: params.addressed,
            type: params.classification.type,
            confidence: params.classification.confidence,
            alternatives: params.classification.alternatives,
            route: params.route,
            reason: params.reason,
        });
    } catch (error) {
        context.log.warn('Failed to record classification', { error });
    }
}

/** Removes rows older than `olderThanDays`. Returns how many went. */
export async function pruneClassificationLog(
    context: Context,
    olderThanDays: number,
): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    try {
        return await context.tables.ClassificationLog.destroy({
            where: { created_at: { [Op.lt]: cutoff } },
        });
    } catch (error) {
        context.log.warn('Failed to prune classification log', { error });
        return 0;
    }
}
