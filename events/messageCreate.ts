const { Events } = require('discord.js');
const response = require('../src/responses');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, context) {
        const { log } = context;
        try {
            if (message.author.bot) {return false;}

            await Promise.allSettled([
                response.Louds(message, context),
                response.Adlibs(message, context),
                response.Triggers(message, context),
            ]);
        } catch (error) {
            log.error(error);
        }
    },
}