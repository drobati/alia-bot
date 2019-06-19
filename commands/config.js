const config = require('../config');
// To set or remove configurations.
// Commands:
//   config add key value
//   config remove key value

module.exports = async (message, commandArgs, model) => {
    const splitArgs = commandArgs.split(' ');
    const action = splitArgs.shift();
    const key = splitArgs.shift();
    const value = splitArgs.join('');

    const { Config } = model;

    if (message.author.id != config.serverOwner) {
        return message.reply('You may not pass!');
    }

    try {
        const record = await Config.findOne({ where: { key: key } });

        switch (action) {
            case 'add':
                if (!record) {
                    await Config.create({ key, value });
                    return message.reply('Config added.');
                } else {
                    await record.update({ key, value });
                    return message.reply('Config updated.');
                }

            case 'remove':
                if (record) {
                    await record.destroy({ force: true });
                    return message.reply('Config removed.');
                }
                return message.reply('Config does not exist.');

            default:
                return message.reply('Config subcommand does not exist.');
        }
    } catch (error) {
        console.log(error);
        return message.reply('Config command had an error.');
    }
};
