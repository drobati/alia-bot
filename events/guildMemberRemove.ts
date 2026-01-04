import { Events, GuildMember, EmbedBuilder } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import { Sentry } from '../src/lib/sentry';
import { sendLogMessage } from '../src/utils/discordHelpers';

function buildMemberLeaveEmbed(member: GuildMember): EmbedBuilder {
    const joinedAt = member.joinedAt;
    const duration = joinedAt
        ? Math.floor((Date.now() - joinedAt.getTime()) / (1000 * 60 * 60 * 24))
        : null;

    const embed = new EmbedBuilder()
        .setColor(0xED4245) // Red
        .setTitle('Member Left')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `${member.user.tag}`, inline: true },
            {
                name: 'Account Created',
                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                inline: true,
            },
            { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

    if (joinedAt) {
        embed.addFields({
            name: 'Joined Server',
            value: `<t:${Math.floor(joinedAt.getTime() / 1000)}:R> (${duration} days)`,
            inline: false,
        });
    }

    // Show roles the member had (excluding @everyone)
    const roles = member.roles.cache
        .filter(role => role.id !== member.guild.id)
        .map(role => role.name)
        .join(', ');

    if (roles) {
        embed.addFields({ name: 'Roles', value: roles, inline: false });
    }

    return embed;
}

const guildMemberRemoveEvent: BotEvent = {
    name: Events.GuildMemberRemove,
    async execute(member: GuildMember, context: Context) {
        const { tables, log } = context;
        const guildId = member.guild.id;

        // Add Sentry breadcrumb for tracing
        Sentry.addBreadcrumb({
            category: 'discord.event',
            message: 'GuildMemberRemove event received',
            level: 'info',
            data: {
                guildId,
                userId: member.id,
                username: member.user.tag,
                memberCount: member.guild.memberCount,
            },
        });

        log.info({
            guildId,
            userId: member.id,
            username: member.user.tag,
            memberCount: member.guild.memberCount,
            category: 'member_leave',
        }, 'Member left server');

        try {
            const embed = buildMemberLeaveEmbed(member);
            await sendLogMessage(member.guild, tables, log, { embeds: [embed] });
        } catch (error) {
            log.error({
                error,
                guildId,
                userId: member.id,
                category: 'member_leave',
            }, 'Error processing member leave event');
        }
    },
};

export default guildMemberRemoveEvent;
