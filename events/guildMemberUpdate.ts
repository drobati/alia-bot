import { Events, GuildMember, EmbedBuilder, Role, AuditLogEvent, User, Guild } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import { Sentry } from '../src/lib/sentry';
import { sendLogMessage } from '../src/utils/discordHelpers';

interface AuditLogResult {
    executor: User | null;
    reason: string | null;
}

/**
 * Fetches the executor from audit logs for a member update action.
 * Returns the user who made the change and any reason provided.
 */
async function fetchAuditLogExecutor(
    guild: Guild,
    targetId: string,
    actionType: AuditLogEvent,
    changeKey?: string,
): Promise<AuditLogResult> {
    try {
        const auditLogs = await guild.fetchAuditLogs({
            type: actionType,
            limit: 5,
        });

        // Find the most recent matching entry
        // Audit logs can have a slight delay, so we look for recent entries
        const now = Date.now();
        const entry = auditLogs.entries.find(log => {
            // Must match the target user - target can be various types
            const target = log.target;
            if (!target || !('id' in target) || target.id !== targetId) {return false;}

            // Must be recent (within 5 seconds)
            if (log.createdTimestamp < now - 5000) {return false;}

            // If we're looking for a specific change key, check for it
            if (changeKey && log.changes) {
                return log.changes.some(change => change.key === changeKey);
            }

            return true;
        });

        // Executor can be a partial user, so we fetch the full user if needed
        let executor: User | null = null;
        if (entry?.executor) {
            if (entry.executor.partial) {
                try {
                    executor = await entry.executor.fetch();
                } catch {
                    // Could not fetch full user, use what we have
                    executor = null;
                }
            } else {
                executor = entry.executor as User;
            }
        }

        return {
            executor,
            reason: entry?.reason ?? null,
        };
    } catch {
        // Bot may not have VIEW_AUDIT_LOG permission
        return { executor: null, reason: null };
    }
}

function buildNicknameChangeEmbed(
    oldMember: GuildMember,
    newMember: GuildMember,
    changedBy: User | null,
    reason: string | null,
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0x5865F2) // Blurple
        .setTitle('Nickname Changed')
        .setThumbnail(newMember.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
            { name: 'Old Nickname', value: oldMember.nickname || '*None*', inline: true },
            { name: 'New Nickname', value: newMember.nickname || '*None*', inline: true },
        );

    // Add who made the change
    if (changedBy) {
        const changedByText = changedBy.id === newMember.id
            ? `<@${changedBy.id}> (self)`
            : `<@${changedBy.id}>`;
        embed.addFields({ name: 'Changed By', value: changedByText, inline: true });
    }

    // Add reason if provided
    if (reason) {
        embed.addFields({ name: 'Reason', value: reason, inline: false });
    }

    embed
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();

    return embed;
}

function buildRoleChangeEmbed(
    member: GuildMember,
    addedRoles: Role[],
    removedRoles: Role[],
    changedBy: User | null,
    reason: string | null,
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C) // Yellow
        .setTitle('Roles Updated')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: false },
        );

    if (addedRoles.length > 0) {
        embed.addFields({
            name: 'Added Roles',
            value: addedRoles.map(r => r.name).join(', '),
            inline: true,
        });
    }

    if (removedRoles.length > 0) {
        embed.addFields({
            name: 'Removed Roles',
            value: removedRoles.map(r => r.name).join(', '),
            inline: true,
        });
    }

    // Add who made the change
    if (changedBy) {
        embed.addFields({ name: 'Changed By', value: `<@${changedBy.id}>`, inline: true });
    }

    // Add reason if provided
    if (reason) {
        embed.addFields({ name: 'Reason', value: reason, inline: false });
    }

    embed
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

    return embed;
}

const guildMemberUpdateEvent: BotEvent = {
    name: Events.GuildMemberUpdate,
    async execute(oldMember: GuildMember, newMember: GuildMember, context: Context) {
        const { tables, log } = context;
        const guildId = newMember.guild.id;

        // Add Sentry breadcrumb for tracing
        Sentry.addBreadcrumb({
            category: 'discord.event',
            message: 'GuildMemberUpdate event received',
            level: 'info',
            data: {
                guildId,
                userId: newMember.id,
                username: newMember.user.tag,
            },
        });

        try {
            // Check for nickname changes
            if (oldMember.nickname !== newMember.nickname) {
                // Fetch audit log to find who made the change
                const { executor, reason } = await fetchAuditLogExecutor(
                    newMember.guild,
                    newMember.id,
                    AuditLogEvent.MemberUpdate,
                    'nick',
                );

                log.info({
                    guildId,
                    userId: newMember.id,
                    username: newMember.user.tag,
                    oldNickname: oldMember.nickname,
                    newNickname: newMember.nickname,
                    changedBy: executor?.tag ?? 'unknown',
                    category: 'member_update',
                }, 'Member nickname changed');

                const embed = buildNicknameChangeEmbed(oldMember, newMember, executor, reason);
                await sendLogMessage(newMember.guild, tables, log, { embeds: [embed] });
            }

            // Check for role changes
            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;

            const addedRoles = newRoles.filter(role => !oldRoles.has(role.id)).map(r => r);
            const removedRoles = oldRoles.filter(role => !newRoles.has(role.id)).map(r => r);

            if (addedRoles.length > 0 || removedRoles.length > 0) {
                // Fetch audit log to find who made the change
                const { executor, reason } = await fetchAuditLogExecutor(
                    newMember.guild,
                    newMember.id,
                    AuditLogEvent.MemberRoleUpdate,
                );

                log.info({
                    guildId,
                    userId: newMember.id,
                    username: newMember.user.tag,
                    addedRoles: addedRoles.map(r => r.name),
                    removedRoles: removedRoles.map(r => r.name),
                    changedBy: executor?.tag ?? 'unknown',
                    category: 'member_update',
                }, 'Member roles changed');

                const embed = buildRoleChangeEmbed(newMember, addedRoles, removedRoles, executor, reason);
                await sendLogMessage(newMember.guild, tables, log, { embeds: [embed] });
            }
        } catch (error) {
            log.error({
                error,
                guildId,
                userId: newMember.id,
                category: 'member_update',
            }, 'Error processing member update event');
        }
    },
};

export default guildMemberUpdateEvent;
