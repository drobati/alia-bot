import { Message } from 'discord.js';
import { triggerCache } from '../utils/triggerCache';
import { Context } from '../types';

export default async (message: Message, context: Context): Promise<boolean> => {
    const { tables } = context;
    const { Memories } = tables;

    // Load triggers into cache if not already loaded
    if (!triggerCache.isReady()) {
        await triggerCache.loadTriggers(Memories);
    }

    const messageLower = message.content.toLowerCase();
    const triggers = triggerCache.getTriggers();

    for (const { key, value } of triggers) {
        if (messageLower.includes(key)) {
            if ('send' in message.channel) {
                try {
                    await message.channel.send(value);
                    return true; // Successfully sent trigger response
                } catch (error) {
                    context.log.error('Trigger response failed:', { error });
                    return false; // Failed to send trigger response
                }
            }
        }
    }

    return false; // No trigger matched
}
