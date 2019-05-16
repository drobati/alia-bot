const Sequelize = require('sequelize');

// https://github.com/desert-planet/hayt/blob/master/scripts/loud.coffee
// Port of louds by annabunches
// Description:
//   ENCOURAGE SHOUTING. LOUD TEXT IS FOREVER.
//   LOUD WILL CAUSE YOUR HUBOT TO STORE ALL-CAPS MESSAGES FROM THE CHANNEL,
//   AND SPIT THEM BACK AT RANDOM IN RESPONSE.
module.exports = async (message, model) => {
    const { Louds, Louds_Banned } = model;

    const regex = /^\s*([A-Z"][A-Z0-9 .,'"()?!&%$#@+-]+)$/;
    if (regex.test(message.content)) {
        // Pick a loud from the stored list and say it. Skip if there are no louds.
        const loud = await Louds.findOne({ order: Sequelize.literal('random()') });

        if (loud) {
            loud.increment('usage_count');
            message.channel.send(loud.message);
        } else {
            message.channel.send('No louds stored yet.');
        }

        // Save new loud in the list, but only if it is unique.
        const newLoud = message.content.trim();

        const exists = await Louds.findOne({ where: { message: newLoud } });
        const banned = await Louds_Banned.findOne({ where: { message: newLoud } });

        if (!exists && !banned) {
            await Louds.create({
                message: newLoud,
                username: message.author.id,
            });
        }
    }
};
