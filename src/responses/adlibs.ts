import Sequelize from "sequelize";

export default async (message: any, { tables }: any) => {
    const { Adlibs } = tables;
    let response = message.content;
    const regex = /(-{3,})+/g;
    if (regex.test(response)) {
        const matches = response.match(regex);

        await Promise.all(
            matches.map(async (match: any) => {
                // Pick an adlib from the stored list and say it. Skip if there are no adlibs.
                const word = match.trim();
                const adlib = await Adlibs.findOne({ order: Sequelize.literal('rand()') });
                if (!adlib) {
                    throw new Error('No adlibs found in table.');
                }

                response = response.replace(word, `**${adlib.value}**`);
            }),
        );

        message.channel.send(response);
    }
}
