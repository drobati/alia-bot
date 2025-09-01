import Sequelize from "sequelize";

export default async (message: any, { tables, log }: any): Promise<boolean> => {
    const { Louds, Louds_Banned } = tables;
    const regex = /^\s*([A-Z"][A-Z0-9 .,'"()?!&%$#@+-]+)$/;
    if (regex.test(message.content)) {
        try {
            // Pick a loud from the stored list and say it. Skip if there are no louds.
            const loud = await Louds.findOne({ order: Sequelize.literal('rand()') });

            if (loud) {
                loud.increment('usage_count');
                await message.channel.send(loud.message);
            } else {
                await message.channel.send('No louds stored yet.');
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

            return true; // Successfully processed LOUDS message
        } catch (error) {
            log.error('Louds response failed:', { error });
            return false; // Failed to process LOUDS message
        }
    }

    return false; // Not a LOUDS message
}
