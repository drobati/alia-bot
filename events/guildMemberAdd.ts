import { Events, GuildMember, TextChannel, PermissionFlagsBits, EmbedBuilder } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import { Sentry } from '../src/lib/sentry';
import { sendLogMessage } from '../src/utils/discordHelpers';

async function getWelcomeChannelId(tables: any, guildId: string): Promise<string | null> {
    const config = await tables.Config.findOne({
        where: { key: `welcome_channel_${guildId}` },
    });
    return config?.value || null;
}

async function getWelcomeMessage(tables: any, guildId: string): Promise<string | null> {
    const config = await tables.Config.findOne({
        where: { key: `welcome_message_${guildId}` },
    });
    return config?.value || null;
}

function formatWelcomeMessage(template: string, member: GuildMember): string {
    const replacements: Record<string, string> = {
        '{user}': `<@${member.id}>`,
        '{server}': member.guild.name,
        '{memberCount}': member.guild.memberCount.toString(),
    };

    let message = template;
    for (const [placeholder, value] of Object.entries(replacements)) {
        message = message.split(placeholder).join(value);
    }
    return message;
}

function buildMemberJoinEmbed(
    member: GuildMember,
    welcomeStatus: { sent: boolean; reason?: string },
): EmbedBuilder {
    return new EmbedBuilder()
        .setColor(welcomeStatus.sent ? 0x57F287 : 0xFEE75C)
        .setTitle('Member Joined')
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
            {
                name: 'Account Created',
                value: `<t:${Math.floor(member.user.createdTimestamp / 1000)}:R>`,
                inline: true,
            },
            { name: 'Member Count', value: member.guild.memberCount.toString(), inline: true },
            {
                name: 'Welcome Message',
                value: welcomeStatus.sent ? 'Sent successfully' : `Not sent: ${welcomeStatus.reason}`,
                inline: false,
            },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();
}

const guildMemberAddEvent: BotEvent = {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember, context: Context) {
        const { tables, log } = context;
        const guildId = member.guild.id;

        // Add Sentry breadcrumb for tracing
        Sentry.addBreadcrumb({
            category: 'discord.event',
            message: 'GuildMemberAdd event received',
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
            category: 'member_join',
        }, 'New member joined server');

        let welcomeStatus: { sent: boolean; reason?: string } = { sent: false, reason: 'Unknown' };

        try {
            // Get welcome channel
            const welcomeChannelId = await getWelcomeChannelId(tables, guildId);
            if (!welcomeChannelId) {
                log.info({
                    guildId,
                    userId: member.id,
                    category: 'member_join',
                }, 'No welcome channel configured - skipping welcome message');
                welcomeStatus = { sent: false, reason: 'No welcome channel configured' };
                const embed = buildMemberJoinEmbed(member, welcomeStatus);
                await sendLogMessage(member.guild, tables, log, { embeds: [embed] });
                return;
            }

            // Get welcome message
            const welcomeTemplate = await getWelcomeMessage(tables, guildId);
            if (!welcomeTemplate) {
                log.info({
                    guildId,
                    userId: member.id,
                    welcomeChannelId,
                    category: 'member_join',
                }, 'No welcome message configured - skipping welcome message');
                welcomeStatus = { sent: false, reason: 'No welcome message configured' };
                const embed = buildMemberJoinEmbed(member, welcomeStatus);
                await sendLogMessage(member.guild, tables, log, { embeds: [embed] });
                return;
            }

            // Find the channel
            const channel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel;
            if (!channel || !channel.isTextBased()) {
                log.warn({
                    welcomeChannelId,
                    guildId,
                    userId: member.id,
                    category: 'member_join',
                }, 'Welcome channel not found or not text-based');
                welcomeStatus = { sent: false, reason: `Channel ${welcomeChannelId} not found` };
                const embed = buildMemberJoinEmbed(member, welcomeStatus);
                await sendLogMessage(member.guild, tables, log, { embeds: [embed] });
                return;
            }

            // Check if bot has permission to send messages
            const botMember = member.guild.members.me;
            if (!botMember || !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
                log.warn({
                    welcomeChannelId,
                    guildId,
                    userId: member.id,
                    category: 'member_join',
                }, 'Bot lacks SendMessages permission in welcome channel');
                welcomeStatus = { sent: false, reason: 'Bot lacks permission in welcome channel' };
                const embed = buildMemberJoinEmbed(member, welcomeStatus);
                await sendLogMessage(member.guild, tables, log, { embeds: [embed] });
                return;
            }

            // Format and send the welcome message
            const welcomeMessage = formatWelcomeMessage(welcomeTemplate, member);

            // Delay to ensure the Discord system join message appears first
            await new Promise(resolve => setTimeout(resolve, 1000));

            await channel.send(welcomeMessage);
            welcomeStatus = { sent: true };

            log.info({
                guildId,
                userId: member.id,
                username: member.user.tag,
                channelId: welcomeChannelId,
                category: 'member_join',
            }, 'Sent welcome message successfully');

            const embed = buildMemberJoinEmbed(member, welcomeStatus);
            await sendLogMessage(member.guild, tables, log, { embeds: [embed] });
        } catch (error) {
            log.error({
                error,
                guildId,
                userId: member.id,
                category: 'member_join',
            }, 'Error processing member join event');
            welcomeStatus = { sent: false, reason: 'Error occurred' };
            const embed = buildMemberJoinEmbed(member, welcomeStatus);
            await sendLogMessage(member.guild, tables, log, { embeds: [embed] });
        }
    },
};

export default guildMemberAddEvent;
