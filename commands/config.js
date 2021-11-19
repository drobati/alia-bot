const config = require('../config');
const { isEmpty } = require('lodash');
// To set or remove configurations.
// Commands:
//   config add key value
//   config remove key value

module.exports = async (message, commandArgs, model) => {
    const commandSyntax = '`config add|remove key value?`';
    const commandSyntaxAdd = ' `config add key value`';
    const commandSyntaxRemove = ' `config remove key`';
    const splitArgs = commandArgs.split(' ');
    const action = splitArgs.shift();
    const key = splitArgs.shift();
    const value = splitArgs.join('');

    const { Config } = model;

    if (message.author.id !== config.serverOwner) {
        return message.channel.send('You may not pass!');
    }

    if (['add', 'remove'].indexOf(action) === -1) {
        return message.channel.send(`Invalid subcommand. Use: ${commandSyntax}`);
    }

    if (key == null) {
        const command = action === 'add' ? commandSyntaxAdd : commandSyntaxRemove;
        return message.channel.send(`Missing key. ${command}`);
    }

    if (isEmpty(value) && action === 'add') {
        return message.channel.send(`Missing value. ${commandSyntaxAdd}`);
    }

    try {
        const record = await Config.findOne({ where: { key: key } });

        switch (action) {
            case 'add':
                if (!record) {
                    await Config.create({ key, value });
                    return message.channel.send('Config added.');
                } else {
                    await record.update({ key, value });
                    return message.channel.send('Config updated.');
                }

            case 'remove':
                if (record) {
                    await record.destroy({ force: true });
                    return message.channel.send('Config removed.');
                }
                return message.channel.send('Config does not exist.');

            default:
                return message.channel.send('Config subcommand does not exist.');
        }
    } catch (error) {
        console.log(error);
        return message.channel.send('Config command had an error.');
    }
};
