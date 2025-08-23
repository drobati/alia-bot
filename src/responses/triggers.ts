import { triggerCache } from '../utils/triggerCache';

export default async (message: any, { tables }: any) => {
    const { Memories } = tables;

    // Load triggers into cache if not already loaded
    if (!triggerCache.isReady()) {
        await triggerCache.loadTriggers(Memories);
    }

    const messageLower = message.content.toLowerCase();
    const triggers = triggerCache.getTriggers();

    for (const { key, value } of triggers) {
        if (messageLower.includes(key)) {
            return await message.channel.send(value);
        }
    }
}
