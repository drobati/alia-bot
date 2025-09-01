import { Events, Message } from 'discord.js';
import { Context, BotEvent } from '../src/utils/types';
import response from '../src/responses'; // Adjust the import path as needed

const messageCreateEvent: BotEvent = {
    name: Events.MessageCreate,
    async execute(message: Message, context: Context) {
        const { log } = context;
        try {
            if (message.author.bot) {
                return;
            }

            // Priority-based response system - only one response per message
            // Priority order: Assistant (NLP) > Triggers > Adlibs > Louds

            let responseHandled = false;

            // 1. Highest Priority: Assistant (NLP Questions)
            try {
                const assistantResult = await response.Assistant(message, context);
                if (assistantResult === true) { // Assistant responded
                    responseHandled = true;
                    context.log.debug('Message handled by Assistant (NLP)', {
                        messageId: message.id,
                        userId: message.author.id,
                    });
                }
            } catch (error) {
                context.log.error('Assistant response failed', { error });
            }

            // 2. Medium-High Priority: Triggers (if NLP didn't respond)
            if (!responseHandled) {
                try {
                    const triggersResult = await response.Triggers(message, context);
                    if (triggersResult === true) { // Triggers responded
                        responseHandled = true;
                        context.log.debug('Message handled by Triggers', {
                            messageId: message.id,
                            userId: message.author.id,
                        });
                    }
                } catch (error) {
                    context.log.error('Triggers response failed', { error });
                }
            }

            // 3. Medium Priority: Adlibs (if nothing else responded)
            if (!responseHandled) {
                try {
                    const adlibsResult = await response.Adlibs(message, context);
                    if (adlibsResult === true) { // Adlibs responded
                        responseHandled = true;
                        context.log.debug('Message handled by Adlibs', {
                            messageId: message.id,
                            userId: message.author.id,
                        });
                    }
                } catch (error) {
                    context.log.error('Adlibs response failed', { error });
                }
            }

            // 4. Lowest Priority: Louds (only if nothing else responded)
            if (!responseHandled) {
                try {
                    const loudsResult = await response.Louds(message, context);
                    if (loudsResult === true) { // Louds responded
                        responseHandled = true;
                        context.log.debug('Message handled by Louds', {
                            messageId: message.id,
                            userId: message.author.id,
                        });
                    }
                } catch (error) {
                    context.log.error('Louds response failed', { error });
                }
            }

            // Log if no response was triggered
            if (!responseHandled) {
                context.log.debug('No response triggered for message', {
                    messageId: message.id,
                    userId: message.author.id,
                    messageLength: message.content.length,
                });
            }
        } catch (error) {
            if (error instanceof Error) {
                log.error(error.message);
            }
        }
    },
};

export default messageCreateEvent;