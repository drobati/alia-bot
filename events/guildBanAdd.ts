import { Events, GuildBan, EmbedBuilder } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import { Sentry } from '../src/lib/sentry';
import { sendLogMessage } from '../src/utils/discordHelpers';

function buildBanEmbed(ban: GuildBan): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(0xED4245) // Red
        .setTitle('Member Banned')
        .setThumbnail(ban.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `${ban.user.tag}`, inline: true },
            {
                name: 'Account Created',
                value: `<t:${Math.floor(ban.user.createdTimestamp / 1000)}:R>`,
                inline: true,
            },
        )
        .setFooter({ text: `User ID: ${ban.user.id}` })
        .setTimestamp();

    if (ban.reason) {
        embed.addFields({ name: 'Reason', value: ban.reason, inline: false });
    }

    return embed;
}

const guildBanAddEvent: BotEvent = {
    name: Events.GuildBanAdd,
    async execute(ban: GuildBan, context: Context) {
        const { tables, log } = context;
        const guildId = ban.guild.id;

        // Add Sentry breadcrumb for tracing
        Sentry.addBreadcrumb({
            category: 'discord.event',
            message: 'GuildBanAdd event received',
            level: 'info',
            data: {
                guildId,
                userId: ban.user.id,
                username: ban.user.tag,
                reason: ban.reason,
            },
        });

        log.info({
            guildId,
            userId: ban.user.id,
            username: ban.user.tag,
            reason: ban.reason,
            category: 'member_ban',
        }, 'Member banned from server');

        try {
            const embed = buildBanEmbed(ban);
            await sendLogMessage(ban.guild, tables, log, { embeds: [embed] });
        } catch (error) {
            log.error({
                error,
                guildId,
                userId: ban.user.id,
                category: 'member_ban',
            }, 'Error processing ban add event');
        }
    },
};

export default guildBanAddEvent;
