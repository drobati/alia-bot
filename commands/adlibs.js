// Description:
//   You are a ____.
//   So ____ maybe you should _____,
//   but perhaps ____.
//
// Dependencies:
//   None
//
// Configuration:
//   None
//
// Commands:
//   adlib add [TEXT]    - Add an adlib to the database.
//   adlib delete [TEXT] - Delete an adlib from the database.
//
// Author:
//   derek r

module.exports = async (message, commandArgs, model) => {
    const splitArgs = commandArgs.split(' ');
    const action = splitArgs.shift();
    const value = splitArgs.join(' ');

    const { Adlibs } = model;

    try {
        const record = await Adlibs.findOne({ where: { value: value } });

        switch (action) {
            case 'add':
                if (!record) {
                    await Adlibs.create({ value });
                    return message.channel.send('Adlib added.');
                } else {
                    return message.channel.send(
                        'Adlib already exists. You can remove it with `!adlib remove <text>`.'
                    );
                }

            case 'remove':
                if (record) {
                    await record.destroy({ force: true });
                    return message.channel.send('Adlib removed.');
                }
                return message.channel.send('Adlib does not exist.');

            default:
                return message.channel.send('Adlib subcommand does not exist.');
        }
    } catch (error) {
        console.log(error);
        return message.channel.send('Adlib command had an error.');
    }
};
