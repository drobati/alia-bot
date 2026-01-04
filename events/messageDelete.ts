import { Events, Message, EmbedBuilder, PartialMessage } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import { Sentry } from '../src/lib/sentry';
import { sendLogMessage } from '../src/utils/discordHelpers';

function buildMessageDeleteEmbed(message: Message | PartialMessage): EmbedBuilder {
    const content = message.content || '*No text content*';
    const truncatedContent = content.length > 1024
        ? content.substring(0, 1021) + '...'
        : content;

    const embed = new EmbedBuilder()
        .setColor(0xEB459E) // Fuchsia
        .setTitle('Message Deleted')
        .addFields(
            { name: 'Author', value: message.author ? `<@${message.author.id}> (${message.author.tag})` : '*Unknown*', inline: true },
            { name: 'Channel', value: `<#${message.channelId}>`, inline: true },
            { name: 'Content', value: truncatedContent, inline: false },
        )
        .setFooter({ text: `Message ID: ${message.id}` })
        .setTimestamp();

    if (message.author) {
        embed.setThumbnail(message.author.displayAvatarURL());
    }

    // Show attachments if any
    if (message.attachments && message.attachments.size > 0) {
        const attachmentList = message.attachments
            .map(a => a.name || a.url)
            .join('\n');
        embed.addFields({
            name: 'Attachments',
            value: attachmentList.length > 1024 ? attachmentList.substring(0, 1021) + '...' : attachmentList,
            inline: false,
        });
    }

    return embed;
}

const messageDeleteEvent: BotEvent = {
    name: Events.MessageDelete,
    async execute(message: Message | PartialMessage, context: Context) {
        const { tables, log } = context;

        // Skip DMs and partial messages without guild
        if (!message.guild) {
            return;
        }

        // Skip bot messages to reduce noise
        if (message.author?.bot) {
            return;
        }

        const guildId = message.guild.id;

        // Add Sentry breadcrumb for tracing
        Sentry.addBreadcrumb({
            category: 'discord.event',
            message: 'MessageDelete event received',
            level: 'info',
            data: {
                guildId,
                channelId: message.channelId,
                messageId: message.id,
                authorId: message.author?.id,
            },
        });

        log.info({
            guildId,
            channelId: message.channelId,
            messageId: message.id,
            authorId: message.author?.id,
            authorTag: message.author?.tag,
            contentLength: message.content?.length || 0,
            category: 'message_delete',
        }, 'Message deleted');

        try {
            const embed = buildMessageDeleteEmbed(message);
            await sendLogMessage(message.guild, tables, log, { embeds: [embed] });
        } catch (error) {
            log.error({
                error,
                guildId,
                messageId: message.id,
                category: 'message_delete',
            }, 'Error processing message delete event');
        }
    },
};

export default messageDeleteEvent;
