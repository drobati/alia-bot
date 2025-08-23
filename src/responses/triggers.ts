import { Message } from 'discord.js';
import { triggerCache } from '../utils/triggerCache';
import { Context } from '../types';

export default async (message: Message, { tables }: Context) => {
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
                return await message.channel.send(value);
            }
        }
    }
}
