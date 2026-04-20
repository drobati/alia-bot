import { Message } from 'discord.js';
import generateResponse from '../utils/assistant';
import { Context } from '../utils/types';
import { safelySendToChannel } from '../utils/discordHelpers';
import { gatherAliaContext } from '../utils/alia-context';
import { recordMessage } from '../utils/conversation-history';
import { parseRememberMarkers, persistMarkers } from '../utils/alia-learn';
import { bumpInteraction } from '../utils/alia-relationships';

export default async (message: Message, context: Context): Promise<boolean> => {
    if (message.author.bot) {
        return false;
    }

    const content = message.content.toLowerCase().trim();
    const botMentioned = message.client.user
        ? message.mentions.has(message.client.user, {
            ignoreEveryone: true,
            ignoreRoles: true,
            ignoreRepliedUser: true,
        })
        : false;
    const startsWithAlia = content.startsWith('alia,') || content.startsWith('alia ');

    if (!botMentioned && !startsWithAlia) {
        return false;
    }

    let processableContent = message.content;
    if (startsWithAlia) {
        processableContent = message.content.replace(/^alia,?\s*/i, '').trim();
    }

    if (!processableContent || processableContent.length < 3) {
        return false;
    }

    const startTime = Date.now();
    const speakerName = (message.member?.displayName) || message.author.username;

    context.log.info('Assistant processing message', {
        userId: message.author.id,
        botMentioned,
        startsWithAlia,
        contentLength: processableContent.length,
    });

    try {
        const extras = await gatherAliaContext(message, context, speakerName);

        const rawResponse = await generateResponse(
            processableContent,
            context,
            {
                userId: message.author.id,
                username: message.author.username,
                displayName: speakerName,
                channelId: message.channelId,
            },
            extras,
        );

        if (rawResponse && message.channel && 'send' in message.channel) {
            // Extract any auto-learn markers and persist them.
            const { markers, cleaned } = parseRememberMarkers(rawResponse);
            const allowedUserIds = new Set(extras.knownUsers.map(u => u.userId));
            const guildId = message.guildId;
            if (markers.length > 0 && guildId) {
                const saved = await persistMarkers(
                    context, markers, guildId, message.author.id, allowedUserIds,
                );
                context.log.info('Auto-learn persisted markers', {
                    userId: message.author.id,
                    attempted: markers.length,
                    saved,
                });
            }

            // If the model only returned markers and no prose, send a fallback.
            const toSend = cleaned.length > 0 ? cleaned : 'Noted.';

            const success = await safelySendToChannel(
                message.channel as any,
                toSend,
                context,
                'assistant response',
            );

            const processingTime = Date.now() - startTime;
            if (success) {
                recordMessage(message.channelId, 'user', speakerName, processableContent);
                recordMessage(message.channelId, 'assistant', 'Alia', toSend);

                if (guildId) {
                    try {
                        await bumpInteraction(context.tables, guildId, message.author.id);
                    } catch (error) {
                        context.log.warn('Failed to bump interaction count', { error });
                    }
                }

                context.log.info('Assistant response sent', {
                    userId: message.author.id,
                    responseLength: toSend.length,
                    markersSaved: markers.length,
                    processingTimeMs: processingTime,
                });
                return true;
            } else {
                context.log.error('Assistant failed to send response', {
                    userId: message.author.id,
                    processingTimeMs: processingTime,
                });
                return false;
            }
        }

        return false;
    } catch (error) {
        const processingTime = Date.now() - startTime;
        context.log.error('Assistant processing error', {
            userId: message.author.id,
            error,
            processingTimeMs: processingTime,
        });
        return false;
    }
};
