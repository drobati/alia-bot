import { Events, Message } from 'discord.js';
import { Context, Event } from '../src/utils/types';
import response from '../src/responses'; // Adjust the import path as needed

const messageCreateEvent: Event<Events.MessageCreate> = {
    name: Events.MessageCreate,
    async execute(message: Message, context: Context) {
        const { log } = context;
        try {
            if (message.author.bot) {
                return;
            }

            await Promise.allSettled([
                response.Louds(message, context),
                response.Adlibs(message, context),
                response.Triggers(message, context),
            ]);
        } catch (error) {
            if (error instanceof Error) {
                log.error(error.message);
            }
        }
    },
};

export default messageCreateEvent;