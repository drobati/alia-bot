// https://github.com/desert-planet/hayt/blob/master/scripts/loud.coffee
// Port of louds by annabunches
// Commands:
// . !loud delete [TEXT] - Delete the loud with the matching text.
// . !loud ban           - Forbid a certain match
// . !loud unban         - Remove forbidden match

const deleteLoud = async (data, model, message, response) => {
    const rowCount = await model.destroy({ where: { message: data } });
    if (!rowCount) {
        return message.reply("Couldn't find that loud.");
    }
    return message.reply(response);
};

const addLoud = async (data, model, message) => {
    const exists = await model.findOne({ where: { message: data } });
    if (!exists) {
        await model.create({
            message: data,
            username: message.author.id,
        });
    }
};

module.exports = async (message, commandArgs, model) => {
    const splitArgs = commandArgs.split(' ');
    const action = splitArgs.shift();
    const data = splitArgs.join(' ');

    const { Louds, Louds_Banned } = model;

    switch (action) {
        case 'delete':
            await deleteLoud(data, Louds, message, 'Loud deleted.');
            break;

        case 'ban':
            await addLoud(data, Louds_Banned, message);
            if (await Louds.findOne({ where: { message: data } })) {
                await deleteLoud(data, Louds, message, 'Loud deleted and banned.');
            } else {
                return message.reply('Loud banned.');
            }
            break;

        case 'unban':
            await addLoud(data, Louds, message);
            if (await Louds_Banned.findOne({ where: { message: data } })) {
                await deleteLoud(data, Louds_Banned, message, 'Loud added and unbanned.');
            } else {
                return message.reply(
                    "Loud added, but wasn't banned. If this wasn't intended use !loud delete."
                );
            }
            break;

        case 'nuke':
            break;

        case 'all':
            break;

        default:
            return message.reply('Loud subcommand does not exist.');
    }
};
