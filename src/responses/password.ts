import { Message, GuildMember } from 'discord.js';
import { Context } from '../types';
import { getLogChannel } from '../utils/discordHelpers';

export default async (message: Message, context: Context): Promise<boolean> => {
    const { tables, log } = context;

    // Must be in a guild
    if (!message.guild || !message.guildId) {
        return false;
    }

    // Query active passwords for this guild + channel
    const rules = await tables.Password.findAll({
        where: {
            guildId: message.guildId,
            channelId: message.channelId,
            active: true,
        },
    });

    if (rules.length === 0) {
        return false;
    }

    const input = message.content.trim().toLowerCase();

    // Find a matching password rule
    const matched = rules.find((r: any) => r.password === input);
    if (!matched) {
        return false;
    }

    const member = message.member as GuildMember;
    if (!member) {
        return false;
    }

    // Skip if user already has the role
    if (member.roles.cache.has(matched.roleId)) {
        return false;
    }

    // Grant the role
    const role = message.guild.roles.cache.get(matched.roleId);
    if (!role) {
        log.error({ roleId: matched.roleId, guildId: message.guildId }, 'Role not found for password rule');
        return false;
    }

    try {
        await member.roles.add(role);
    } catch (roleError) {
        log.error({ error: roleError, roleId: matched.roleId }, 'Failed to assign role via password');
        return false;
    }

    // Delete the user's message
    try {
        await message.delete();
    } catch (deleteError) {
        log.warn({ error: deleteError, messageId: message.id }, 'Failed to delete password message');
    }

    // Log to log channel if configured
    const logChannel = await getLogChannel(message.guild, tables, log);
    if (logChannel) {
        const timestamp = new Date().toISOString().replace('T', ' ').substring(0, 19);
        const logMessage = `[${timestamp}] <@${message.author.id}> used password`
            + ` in <#${message.channelId}> → granted @${role.name}`;
        try {
            await logChannel.send(logMessage);
        } catch (logError) {
            log.warn({ error: logError }, 'Failed to send password log message');
        }
    }

    log.info({
        guildId: message.guildId,
        channelId: message.channelId,
        userId: message.author.id,
        roleId: matched.roleId,
        roleName: role.name,
    }, 'Password used successfully');

    return true;
};
