import { Events, GuildMember, TextChannel, PermissionFlagsBits } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';

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

const guildMemberAddEvent: BotEvent = {
    name: Events.GuildMemberAdd,
    async execute(member: GuildMember, context: Context) {
        const { tables, log } = context;

        try {
            const guildId = member.guild.id;

            // Get welcome channel
            const welcomeChannelId = await getWelcomeChannelId(tables, guildId);
            if (!welcomeChannelId) {
                log.debug({ guildId }, 'No welcome channel configured');
                return;
            }

            // Get welcome message
            const welcomeTemplate = await getWelcomeMessage(tables, guildId);
            if (!welcomeTemplate) {
                log.debug({ guildId }, 'No welcome message configured');
                return;
            }

            // Find the channel
            const channel = member.guild.channels.cache.get(welcomeChannelId) as TextChannel;
            if (!channel || !channel.isTextBased()) {
                log.warn({ welcomeChannelId, guildId }, 'Welcome channel not found or not text-based');
                return;
            }

            // Check if bot has permission to send messages
            const botMember = member.guild.members.me;
            if (!botMember || !channel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
                log.warn({ welcomeChannelId, guildId }, 'Bot lacks SendMessages permission in welcome channel');
                return;
            }

            // Format and send the welcome message
            const welcomeMessage = formatWelcomeMessage(welcomeTemplate, member);

            await channel.send(welcomeMessage);

            log.info({
                guildId,
                userId: member.id,
                username: member.user.tag,
                channelId: welcomeChannelId,
            }, 'Sent welcome message');
        } catch (error) {
            log.error({ error, guildId: member.guild.id, userId: member.id }, 'Error sending welcome message');
        }
    },
};

export default guildMemberAddEvent;
