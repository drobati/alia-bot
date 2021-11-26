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

module.exports = async (message, Adlibs) => {
    const words = message.content.split(' ').splice(1);
    const action = words.shift();
    const value = words.join(' ');

    const record = await Adlibs.findOne({ where: { value } });
    switch (action) {
        case 'add':
            if (!record) {
                await Adlibs.create({ value });
                return await message.channel.send("I've added that adlib.");
            } else {
                return await message.channel.send('That adlib already exists.');
            }

        case 'remove':
            if (record) {
                await record.destroy({ force: true });
                return await message.channel.send("I've removed that adlib.");
            }
            return await message.channel.send("I don't recognize that adlib.");

        default:
            return await message.channel.send("I don't recognize that command.");
    }
};
