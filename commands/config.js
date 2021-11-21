const config = require('../config');
const { isEmpty } = require('lodash');
// To set or remove configurations.
// Commands:
//   config add key value
//   config remove key value

module.exports = async (message, Config) => {
    const commandSyntax = '`config add|remove key value?`';
    const commandSyntaxAdd = '`config add key value`';
    const commandSyntaxRemove = '`config remove key`';

    const words = message.content.split(' ').splice(1);
    const action = words.shift();
    const key = words.shift();
    const value = words.join('');

    if (message.author.id !== config.serverOwner) {
        return await message.channel.send('You may not pass!');
    }

    if (['add', 'remove'].indexOf(action) === -1) {
        return await message.channel.send(`Invalid subcommand. Use ${commandSyntax}`);
    }

    if (key == null) {
        const command = action === 'add' ? commandSyntaxAdd : commandSyntaxRemove;
        return await message.channel.send(`Missing key. Use ${command}`);
    }

    if (isEmpty(value) && action === 'add') {
        return await message.channel.send(`Missing value. Use ${commandSyntaxAdd}`);
    }

    const record = await Config.findOne({ where: { key: key } });

    if (action === 'add') {
        await Config.upsert({ key, value });
        if (!record) {
            return await message.channel.send("I've added the config.");
        } else {
            return await message.channel.send("I've updated the config.");
        }
    }
    // since we check above for remove...
    if (record) {
        await record.destroy({ force: true });
        return await message.channel.send("I've removed the config.");
    }
    return await message.channel.send("I don't know that config.");
};
