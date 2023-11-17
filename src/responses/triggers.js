// This script listens for messages from the server
// and responds with records from the Memories table
// if there is a match
module.exports = async (message, { tables }) => {
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
};
