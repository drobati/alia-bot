import { Events, GuildMember, EmbedBuilder, Role } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import { Sentry } from '../src/lib/sentry';
import { sendLogMessage } from '../src/utils/discordHelpers';

function buildNicknameChangeEmbed(
    oldMember: GuildMember,
    newMember: GuildMember,
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(0x5865F2) // Blurple
        .setTitle('Nickname Changed')
        .setThumbnail(newMember.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `<@${newMember.id}> (${newMember.user.tag})`, inline: true },
            { name: 'Old Nickname', value: oldMember.nickname || '*None*', inline: true },
            { name: 'New Nickname', value: newMember.nickname || '*None*', inline: true },
        )
        .setFooter({ text: `User ID: ${newMember.id}` })
        .setTimestamp();
}

function buildRoleChangeEmbed(
    member: GuildMember,
    addedRoles: Role[],
    removedRoles: Role[],
): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0xFEE75C) // Yellow
        .setTitle('Roles Updated')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: false },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

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
                log.info({
                    guildId,
                    userId: newMember.id,
                    username: newMember.user.tag,
                    oldNickname: oldMember.nickname,
                    newNickname: newMember.nickname,
                    category: 'member_update',
                }, 'Member nickname changed');

                const embed = buildNicknameChangeEmbed(oldMember, newMember);
                await sendLogMessage(newMember.guild, tables, log, { embeds: [embed] });
            }

            // Check for role changes
            const oldRoles = oldMember.roles.cache;
            const newRoles = newMember.roles.cache;

            const addedRoles = newRoles.filter(role => !oldRoles.has(role.id)).map(r => r);
            const removedRoles = oldRoles.filter(role => !newRoles.has(role.id)).map(r => r);

            if (addedRoles.length > 0 || removedRoles.length > 0) {
                log.info({
                    guildId,
                    userId: newMember.id,
                    username: newMember.user.tag,
                    addedRoles: addedRoles.map(r => r.name),
                    removedRoles: removedRoles.map(r => r.name),
                    category: 'member_update',
                }, 'Member roles changed');

                const embed = buildRoleChangeEmbed(newMember, addedRoles, removedRoles);
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
