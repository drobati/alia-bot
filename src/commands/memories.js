// https://github.com/desert-planet/hayt/blob/master/scripts/remember.coffee
//
// Commands:
// . !remember get <key> - Returns a string
// . !remember trigger <key> - Flags a key as triggered
// . !remember add <key> <value>. - Returns nothing. Remembers the text for next time!
// . !remember delete <key> - Removes key from hubots brain.
// . !remember top <amount> - Returns top 5 hubot remembers.
// . !remember random - Returns a random string
const each = require('lodash/each');
const sequelize = require('sequelize');
const { toNumber } = require('lodash');

const upsertMemory = async ({ message, Memories, key, value }) => {
    const record = await Memories.findOne({ where: { key } });
    await Memories.upsert({ key, value });
    if (record) {
        const oldValue = record.value;
        return message.channel.send(`"${key}" is now \n"${value}" \nand was \n"${oldValue}"`);
    }
    return message.channel.send(`"${key}" is now "${value}".`);
};

const getMemory = async ({ message, Memories, key }) => {
    const record = await Memories.findOne({ where: { key } });
    if (record) return await message.channel.send(`"${key}" is "${record.value}".`);
    return await message.channel.send(`I can't remember, ${key}.`);
};

const removeMemory = async ({ message, Memories, key }) => {
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        await record.destroy({ where: { key } });
        return message.channel.send(`"${key}" was "${record.value}".`);
    }
    return message.channel.send(`I can't remember, ${key}.`);
};

const flagTriggered = async ({ message, Memories, key, triggered = true }) => {
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        await record.update({ triggered });
        const triggeredString = triggered ? 'triggered' : 'untriggered';
        return message.channel.send(`"${key}" is now ${triggeredString}.`);
    }
    return message.channel.send(`I can't remember, ${key}.`);
};

const getFavoriteMemories = async ({ message, Memories, count = 1 }) => {
    if (count > 10) count = 10;
    let response = `Top ${count} Memories:\n`;
    const records = await Memories.findAll({
        order: sequelize.col('read_count'),
        limit: toNumber(count)
    });
    if (records.length > 0) {
        each(records, (record) => {
            response += ` * "${record.key}" is "${record.value}"\n`;
        });
        return message.channel.send(response.slice(0, -1));
    }
    return message.channel.send("I can't remember anything.");
};

const getRandomMemories = async ({ message, Memories, count = 1 }) => {
    if (count > 10) count = 10;
    let response = `Random ${count} Memories:\n`;
    const records = await Memories.findAll({
        order: sequelize.literal('rand()'),
        limit: toNumber(count)
    });
    if (records.length > 0) {
        each(records, (record) => {
            response += ` * "${record.key}" is "${record.value}"\n`;
        });
        return message.channel.send(response.slice(0, -1));
    }
    return message.channel.send("I can't remember anything.");
};

module.exports = async (message, Memories) => {
    const words = message.content.split(' ').splice(1);
    const command = words.shift();
    const key = words.shift();
    const value = words.join(' ');
    switch (command) {
        case 'get':
            return getMemory({ message, Memories, key });
        case 'add':
            return upsertMemory({ message, Memories, key, value });
        case 'delete':
            return removeMemory({ message, Memories, key });
        case 'top':
            return getFavoriteMemories({ message, Memories, count: key });
        case 'random':
            return getRandomMemories({ message, Memories, count: key });
        case 'trigger':
            return flagTriggered({ message, Memories, key });
        case 'untrigger':
            return flagTriggered({ message, Memories, key, triggered: false });
        default:
            return message.channel.send("I don't understand that command.");
    }
};
