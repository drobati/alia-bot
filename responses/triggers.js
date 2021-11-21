// This script listens for messages from the server
// and responds with records from the Memories table
// if there is a match
module.exports = async (message, Memories) => {
    const triggers = await Memories.findAll({
        where: {
            trigger: true
        }
    });

    const messageLower = message.content.toLowerCase();

    for (const { key, value } of triggers) {
        if (messageLower.includes(key.toLowerCase())) {
            return await message.channel.send(value);
        }
    }
};
