// https://github.com/desert-planet/hayt/blob/master/scripts/remember.coffee
//
// Port of remember by skalnik
//
// Commands:
// . ? is|remember <key> - Returns a string
// . ? <key> is <value>. - Returns nothing. Remembers the text for next time!
// . ? what do you remember - Returns top 5 hubot remembers.
// . ? forget <key> - Removes key from hubots brain.
// . ? what are your favorite memories? - Returns a list of the most remembered memories.
// . ? random memory - Returns a random string
const { stripIndent } = require('common-tags');
const each = require('lodash/each');
const sequelize = require('sequelize');

const writeMemory = async (params, terms) => {
    const { reply, Memories } = params;
    const { key, value } = terms;
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        const oldValue = record.value;
        await record.update({ key, value });
        return reply(`${key} is now ${value} and was ${oldValue}.`);
    }
    await Memories.create({ key, value });
    return reply(`${key} is now ${value}.`);
};

const getMemory = async (params, terms) => {
    const { reply, Memories } = params;
    const { key } = terms;
    const record = await Memories.findOne({ where: { key } });
    if (record) return reply(`${key} is ${record.value}.`);
    return reply(`I have no memory of ${key}.`);
};

const removeMemory = async (params, terms) => {
    const { reply, Memories } = params;
    const { key } = terms;
    const record = await Memories.findOne({ where: { key } });
    if (record) {
        await record.destroy({ where: { key } });
        return reply(`${key} was ${record.value}.`);
    }
    return reply(`I have no memory of ${key}.`);
};

const getFavoriteMemories = async params => {
    const { reply, Memories } = params;
    let message = 'Top Five Memories:\n';

    const records = await Memories.findAll({
        order: sequelize.col('read_count'),
        limit: 5,
    });

    if (records.length > 0) {
        each(records, record => {
            message += ` * ${record.key} is ${record.value}\n`;
        });
        return reply(message.slice(0, -1));
    }
    return reply('I have no memories to give.');
};

const getRandomMemory = async params => {
    const { reply, Memories } = params;

    const record = await Memories.findOne({
        order: sequelize.literal('random()'),
    });

    if (record) return reply(`Random ${record.key} is ${record.value}.`);
    return reply('I have no memories to give.');
};

module.exports = async (message, model) => {
    const { Memories } = model;
    const { content, reply } = message;

    const command = content.slice(2);

    const params = { reply, Memories };

    const get = /^(?:(?:what )?is|rem(?:ember)?)\s+(.*)$/;
    const write = /(.*?)(\s+is\s+([\s\S]*))$/;
    const remove = /^forget\s+(.*)/;
    const getFavorites = /favorite memories$/;
    const getRandom = /random memory$/;
    // Check for each type of match.
    if (get.test(command)) {
        const matches = command.match(get);
        await getMemory(params, { key: matches[1] });
    } else if (write.test(command)) {
        const matches = command.match(write);
        await writeMemory(params, { key: matches[1], value: matches[3] });
    } else if (remove.test(command)) {
        const matches = command.match(remove);
        await removeMemory(params, { key: matches[1] });
    } else if (getFavorites.test(command)) {
        await getFavoriteMemories(params);
    } else if (getRandom.test(command)) {
        await getRandomMemory(params);
    }
    // don't respond if nothing matches.
};
