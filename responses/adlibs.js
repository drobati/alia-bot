// This script will respond with adlibs to the syntax of ---.

const Sequelize = require('sequelize');

module.exports = async (message, model) => {
    const { Adlibs } = model;

    let response = message.content;
    const regex = /(_{3,})+/g;
    if (regex.test(response)) {
        const matches = response.match(regex);

        try {
            await Promise.all(
                matches.map(async (match) => {
                    // Pick an adlib from the stored list and say it. Skip if there are no adlibs.
                    const word = match.trim();
                    const adlib = await Adlibs.findOne({ order: Sequelize.literal('rand()') });

                    if (!adlib) {
                        throw new Error('No adlibs found.');
                    }

                    response = response.replace(word, adlib.value);
                })
            );

            message.delete();
            message.channel.send(response);
        } catch (e) {
            if (e.message === 'No adlibs found.') {
                message.channel.send('No adlibs found.');
            } else {
                console.error(e);
            }
        }
    }
};
