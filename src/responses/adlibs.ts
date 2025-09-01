import Sequelize from "sequelize";

export default async (message: any, { tables, log }: any): Promise<boolean> => {
    const { Adlibs } = tables;
    let response = message.content;
    const regex = /(-{3,})+/g;
    if (regex.test(response)) {
        try {
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

            await message.channel.send(response);
            return true; // Successfully processed Adlibs message
        } catch (error) {
            log.error('Adlibs response failed:', { error });
            return false; // Failed to process Adlibs message
        }
    }

    return false; // Not an Adlibs message
}
