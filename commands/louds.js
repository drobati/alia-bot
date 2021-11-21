// https://github.com/desert-planet/hayt/blob/master/scripts/loud.coffee
// Port of louds by annabunches
// Commands:
// . !loud delete [TEXT] - Delete the loud with the matching text.
// . !loud ban           - Forbid a certain match
// . !loud unban         - Remove forbidden match

const deleteLoud = async (data, model, message, response) => {
    const rowCount = await model.destroy({ where: { message: data } });
    if (!rowCount) {
        return message.channel.send("I couldn't find that loud.");
    }
    return message.channel.send(response);
};

const addLoud = async (data, model, message) => {
    const exists = await model.findOne({ where: { message: data } });
    if (!exists) {
        await model.create({
            message: data,
            username: message.author.id
        });
    }
};

module.exports = async (message, Louds, Louds_Banned) => {
    const words = message.content.split(' ').splice(1);
    const action = words.shift();
    const data = words.join(' ');

    switch (action) {
        case 'delete':
            return await deleteLoud(data, Louds, message, "I've removed that loud.");

        case 'ban':
            await addLoud(data, Louds_Banned, message);
            if (await Louds.findOne({ where: { message: data } })) {
                return await deleteLoud(data, Louds, message, "I've removed & banned that loud.");
            }
            return message.channel.send("I've banned that loud.");

        case 'unban':
            if (await Louds_Banned.findOne({ where: { message: data } })) {
                await addLoud(data, Louds, message);
                return await deleteLoud(
                    data,
                    Louds_Banned,
                    message,
                    "I've added & unbanned that loud."
                );
            } else {
                return message.channel.send("That's not banned.");
            }

        default:
            return message.channel.send("I don't recognize that command.");
    }
};
