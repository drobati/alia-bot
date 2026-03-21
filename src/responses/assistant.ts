import { Message } from 'discord.js';
import generateResponse from '../utils/assistant';
import { Context } from '../utils/types';
import { safelySendToChannel } from '../utils/discordHelpers';

export default async (message: Message, context: Context): Promise<boolean> => {
    if (message.author.bot) {
        return false;
    }

    // Only process messages that explicitly address the bot
    const content = message.content.toLowerCase().trim();
    const botMentioned = message.mentions.has(message.client.user!);
    const startsWithAlia = content.startsWith('alia,') || content.startsWith('alia ');

    if (!botMentioned && !startsWithAlia) {
        return false;
    }

    // Remove the "Alia," prefix for processing
    let processableContent = message.content;
    if (startsWithAlia) {
        processableContent = message.content.replace(/^alia,?\s*/i, '').trim();
    }

    // If after removing prefix, there's no meaningful content, skip
    if (!processableContent || processableContent.length < 3) {
        return false;
    }

    const startTime = Date.now();
    context.log.info('Assistant processing message', {
        userId: message.author.id,
        botMentioned,
        startsWithAlia,
        contentLength: processableContent.length,
    });

    try {
        const response = await generateResponse(processableContent, context, {
            userId: message.author.id,
            username: message.author.username,
            channelId: message.channelId,
        });

        if (response && message.channel && 'send' in message.channel) {
            const success = await safelySendToChannel(
                message.channel as any,
                response,
                context,
                'assistant response',
            );

            const processingTime = Date.now() - startTime;
            if (success) {
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
}
