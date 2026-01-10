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
            // Priority order: Verification > D&D > Assistant (NLP) > Triggers > Adlibs > Louds

            let responseHandled = false;

            // 0. Top Priority: Verification (Welcome channel code processing)
            try {
                const verificationResult = await response.Verification(message, context);
                if (verificationResult === true) {
                    responseHandled = true;
                    context.log.debug('Message handled by Verification', {
                        messageId: message.id,
                        userId: message.author.id,
                    });
                }
            } catch (error) {
                context.log.error('Verification response failed', { error });
            }

            // 1. High Priority: D&D (Channel-specific game responses)
            if (!responseHandled) {
                try {
                    const dndResult = await response.Dnd(message, context);
                    if (dndResult === true) { // D&D game handled
                        responseHandled = true;
                        context.log.debug('Message handled by D&D', {
                            messageId: message.id,
                            userId: message.author.id,
                        });
                    }
                } catch (error) {
                    context.log.error('D&D response failed', { error });
                }
            }

            // 2. High Priority: Assistant (NLP Questions)
            if (!responseHandled) {
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

            // 2.5. Medium Priority: Greetings (goodmorning/goodnight responses)
            if (!responseHandled) {
                try {
                    const greetingsResult = await response.Greetings(message, context);
                    if (greetingsResult === true) { // Greetings responded
                        responseHandled = true;
                        context.log.debug('Message handled by Greetings', {
                            messageId: message.id,
                            userId: message.author.id,
                        });
                    }
                } catch (error) {
                    context.log.error('Greetings response failed', { error });
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

            // 4. Low Priority: Louds (only if nothing else responded)
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

            // 5. Lowest Priority: Tips (occasional helpful tips, only if nothing else responded)
            if (!responseHandled) {
                try {
                    const tipsResult = await response.Tips(message, context);
                    if (tipsResult === true) { // Tips responded
                        responseHandled = true;
                        context.log.debug('Message handled by Tips', {
                            messageId: message.id,
                            userId: message.author.id,
                        });
                    }
                } catch (error) {
                    context.log.error('Tips response failed', { error });
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

            // Process message for Sparks currency (independent of response handling)
            if (context.sparksService) {
                try {
                    await context.sparksService.processMessage(message);
                } catch (sparksError) {
                    context.log.error('Sparks processing failed', { error: sparksError });
                }
            }
        } catch (error) {
            if (error instanceof Error) {
                log.error(error.message);
            }
        }
    },
};

export default messageCreateEvent;