import { Message } from 'discord.js';
import generateResponse from '../utils/assistant';
import { Context } from '../utils/types';
import { safelySendToChannel } from '../utils/discordHelpers';
import { gatherAliaContext } from '../utils/alia-context';
import { recordMessage } from '../utils/conversation-history';

export default async (message: Message, context: Context): Promise<boolean> => {
    if (message.author.bot) {
        return false;
    }

    // Only process messages that explicitly address the bot.
    // ignoreEveryone prevents @here / @everyone from looking like a direct mention.
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
        const extras = await gatherAliaContext(message, context);

        // Record the incoming message in history BEFORE calling generateResponse
        // so the model sees it as the latest user turn via the explicit user
        // message, and sees prior context via history.
        const response = await generateResponse(
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

        if (response && message.channel && 'send' in message.channel) {
            const success = await safelySendToChannel(
                message.channel as any,
                response,
                context,
                'assistant response',
            );

            const processingTime = Date.now() - startTime;
            if (success) {
                // Only persist turns we actually delivered.
                recordMessage(message.channelId, 'user', speakerName, processableContent);
                recordMessage(message.channelId, 'assistant', 'Alia', response);

                context.log.info('Assistant response sent', {
                    userId: message.author.id,
                    responseLength: response.length,
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
