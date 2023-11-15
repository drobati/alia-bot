const { Events } = require('discord.js');
const response = require('../src/responses');

module.exports = {
    name: Events.MessageCreate,
    async execute(message, context) {
        const { log } = context;
        try {
            if (message.author.bot) return '';

            await response.Louds(message, context);
            await response.Adlibs(message, context);
            await response.Triggers(message, context);
        } catch (error) {
            log.error(error);
        }
    }
}