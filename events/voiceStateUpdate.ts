import { Events, VoiceState, EmbedBuilder } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import { Sentry } from '../src/lib/sentry';
import { sendLogMessage } from '../src/utils/discordHelpers';

type VoiceAction = 'joined' | 'left' | 'moved';

function buildVoiceStateEmbed(
    oldState: VoiceState,
    newState: VoiceState,
    action: VoiceAction,
): EmbedBuilder {
    const member = newState.member || oldState.member;
    if (!member) {
        return new EmbedBuilder()
            .setColor(0x99AAB5)
            .setTitle('Voice Activity')
            .setDescription('Unknown member voice activity')
            .setTimestamp();
    }

    const colorMap: Record<VoiceAction, number> = {
        joined: 0x57F287, // Green
        left: 0xED4245,   // Red
        moved: 0x5865F2,  // Blurple
    };

    const titleMap: Record<VoiceAction, string> = {
        joined: 'Joined Voice Channel',
        left: 'Left Voice Channel',
        moved: 'Moved Voice Channels',
    };

    const embed = new EmbedBuilder()
        .setColor(colorMap[action])
        .setTitle(titleMap[action])
        .setThumbnail(member.user.displayAvatarURL())
        .addFields(
            { name: 'User', value: `<@${member.id}> (${member.user.tag})`, inline: true },
        )
        .setFooter({ text: `User ID: ${member.id}` })
        .setTimestamp();

    if (action === 'joined' && newState.channel) {
        embed.addFields({ name: 'Channel', value: `<#${newState.channel.id}>`, inline: true });
    } else if (action === 'left' && oldState.channel) {
        embed.addFields({ name: 'Channel', value: `<#${oldState.channel.id}>`, inline: true });
    } else if (action === 'moved') {
        embed.addFields(
            { name: 'From', value: oldState.channel ? `<#${oldState.channel.id}>` : '*Unknown*', inline: true },
            { name: 'To', value: newState.channel ? `<#${newState.channel.id}>` : '*Unknown*', inline: true },
        );
    }

    return embed;
}

const voiceStateUpdateEvent: BotEvent = {
    name: Events.VoiceStateUpdate,
    async execute(oldState: VoiceState, newState: VoiceState, context: Context) {
        const { tables, log } = context;

        const guild = newState.guild || oldState.guild;
        if (!guild) {
            return;
        }

        const member = newState.member || oldState.member;
        if (!member) {
            return;
        }

        // Skip bot voice state changes to reduce noise
        if (member.user.bot) {
            return;
        }

        const guildId = guild.id;
        const oldChannel = oldState.channel;
        const newChannel = newState.channel;

        // Determine the action type
        let action: VoiceAction | null = null;

        if (!oldChannel && newChannel) {
            action = 'joined';
        } else if (oldChannel && !newChannel) {
            action = 'left';
        } else if (oldChannel && newChannel && oldChannel.id !== newChannel.id) {
            action = 'moved';
        }

        // If no channel change, skip (could be mute/deafen)
        if (!action) {
            return;
        }

        // Add Sentry breadcrumb for tracing
        Sentry.addBreadcrumb({
            category: 'discord.event',
            message: 'VoiceStateUpdate event received',
            level: 'info',
            data: {
                guildId,
                userId: member.id,
                username: member.user.tag,
                action,
                oldChannelId: oldChannel?.id,
                newChannelId: newChannel?.id,
            },
        });

        log.info({
            guildId,
            userId: member.id,
            username: member.user.tag,
            action,
            oldChannelId: oldChannel?.id,
            oldChannelName: oldChannel?.name,
            newChannelId: newChannel?.id,
            newChannelName: newChannel?.name,
            category: 'voice_state',
        }, `Member ${action} voice channel`);

        try {
            const embed = buildVoiceStateEmbed(oldState, newState, action);
            await sendLogMessage(guild, tables, log, { embeds: [embed] });
        } catch (error) {
            log.error({
                error,
                guildId,
                userId: member.id,
                category: 'voice_state',
            }, 'Error processing voice state update event');
        }
    },
};

export default voiceStateUpdateEvent;
