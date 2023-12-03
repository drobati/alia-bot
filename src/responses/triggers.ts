export default async (message: any, { tables }: any) => {
    const { Memories } = tables;
    // feel like caching this would be a good idea, honestly this is so unhinged of me
    const triggers = await Memories.findAll({
        where: {
            triggered: true,
        },
    });

    const messageLower = message.content.toLowerCase();

    for (const { key, value } of triggers) {
        if (messageLower.includes(key.toLowerCase())) {
            return await message.channel.send(value);
        }
    }
}
