import { Message } from 'discord.js';
import { Context } from '../utils/types';
import { DndGameAttributes } from '../types/database';
import { sendLongMessage } from '../utils/discordHelpers';
import { openrouter, getModel } from '../utils/openrouter';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Track message collection timers per game
const messageTimers = new Map<number, NodeJS.Timeout>();

export default async (message: Message, context: Context): Promise<boolean> => {
    // Skip bot messages
    if (message.author.bot) {
        return false;
    }

    const guildId = message.guildId;
    const channelId = message.channelId;

    if (!guildId) {
        return false;
    }

    try {
        // Find active game for this guild and channel
        const game = await context.tables.DndGame.findOne({
            where: {
                guildId,
                channelId,
                isActive: true,
            },
        }) as unknown as DndGameAttributes | null;

        if (!game || !game.id) {
            return false; // No active game in this channel
        }

        context.log.info('D&D message received', {
            gameId: game.id,
            gameName: game.name,
            userId: message.author.id,
            username: message.author.username,
            messageLength: message.content.length,
        });

        // Add message to pending collection
        const newMessage = {
            userId: message.author.id,
            username: message.author.username,
            content: message.content,
            timestamp: new Date(),
        };

        const updatedPendingMessages = [...(game.pendingMessages || []), newMessage];

        // Update game with new pending message
        await context.tables.DndGame.update(
            {
                pendingMessages: updatedPendingMessages as any,
            },
            { where: { id: game.id } },
        );

        // Clear existing timer for this game if any
        const existingTimer = messageTimers.get(game.id);
        if (existingTimer) {
            clearTimeout(existingTimer);
        }

        // Set new timer to process messages after wait period
        const waitTimeMs = game.waitPeriodMinutes * 60 * 1000;
        const timer = setTimeout(async () => {
            await processCollectedMessages(game.id!, context);
            messageTimers.delete(game.id!);
        }, waitTimeMs);

        messageTimers.set(game.id, timer);

        context.log.info('D&D message collected', {
            gameId: game.id,
            gameName: game.name,
            pendingCount: updatedPendingMessages.length,
            waitTimeMinutes: game.waitPeriodMinutes,
        });

        // Return true to indicate we handled this message
        return true;

    } catch (error) {
        context.log.error('D&D response handler error', {
            error,
            guildId,
            channelId,
        });
        return false;
    }
};

async function processCollectedMessages(gameId: number, context: Context) {
    try {
        // Fetch latest game state
        const game = await context.tables.DndGame.findOne({
            where: { id: gameId },
        }) as unknown as DndGameAttributes | null;

        if (!game || !game.pendingMessages || game.pendingMessages.length === 0) {
            context.log.debug('No messages to process', { gameId });
            return;
        }

        context.log.info('Processing collected D&D messages', {
            gameId,
            gameName: game.name,
            messageCount: game.pendingMessages.length,
        });

        // Format collected messages into a single user prompt
        const userPrompt = game.pendingMessages
            .map(msg => `${msg.username}: ${msg.content}`)
            .join('\n');

        // Generate response using OpenRouter
        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: game.systemPrompt },
            ...(game.conversationHistory as ChatCompletionMessageParam[] || []),
            { role: 'user', content: userPrompt },
        ];

        context.log.info('Sending D&D prompt to OpenRouter', {
            gameId,
            gameName: game.name,
            messageCount: messages.length,
            userPromptLength: userPrompt.length,
        });

        const completion = await openrouter.chat.completions.create({
            model: getModel(),
            messages,
            max_tokens: 500,
            temperature: 0.8,
        });

        const response = completion.choices[0].message.content;

        if (!response) {
            context.log.error('No response from OpenRouter', { gameId, gameName: game.name });
            return;
        }

        context.log.info('Received D&D response from OpenRouter', {
            gameId,
            gameName: game.name,
            responseLength: response.length,
            tokensUsed: completion.usage?.total_tokens,
        });

        // Update conversation history
        const updatedHistory = [
            ...(game.conversationHistory || []),
            { role: 'user' as const, content: userPrompt },
            { role: 'assistant' as const, content: response },
        ];

        // Keep only last 20 messages to prevent token overflow
        const trimmedHistory = updatedHistory.slice(-20);

        // Update game state
        await context.tables.DndGame.update(
            {
                conversationHistory: trimmedHistory as any,
                currentRound: game.currentRound + 1,
                pendingMessages: [] as any,
                lastResponseTime: new Date(),
            },
            { where: { id: gameId } },
        );

        // Send response to channel (may be split into multiple messages)
        if (game.channelId && context.client) {
            try {
                const channel = await context.client.channels.fetch(game.channelId);

                if (channel && 'send' in channel) {
                    const success = await sendLongMessage(
                        channel as any,
                        response,
                        context,
                        'D&D response',
                    );

                    if (success) {
                        context.log.info('D&D response sent successfully', {
                            gameId,
                            gameName: game.name,
                            round: game.currentRound + 1,
                            responseLength: response.length,
                        });
                    } else {
                        context.log.error('Failed to send D&D response to channel', {
                            gameId,
                            gameName: game.name,
                            channelId: game.channelId,
                        });
                    }
                }
            } catch (channelError) {
                // Enhanced error logging with Discord API error details
                const errorDetails: any = {
                    error: channelError,
                    gameId,
                    channelId: game.channelId,
                    gameName: game.name,
                };

                // Extract Discord API error code if available
                if (channelError && typeof channelError === 'object' && 'code' in channelError) {
                    const discordError = channelError as { code: number; message: string };
                    errorDetails.discordErrorCode = discordError.code;
                    errorDetails.discordErrorMessage = discordError.message;

                    // Map error codes to human-readable explanations
                    const errorCodeMap: Record<number, string> = {
                        10003: 'Unknown Channel - channel may have been deleted',
                        50001: 'Missing Access - bot lacks access to the channel',
                        50013: 'Missing Permissions - bot needs Send Messages permission',
                        50035: 'Invalid Form Body - message content may be invalid',
                    };

                    errorDetails.errorExplanation = errorCodeMap[discordError.code]
                        || `Unknown Discord error code: ${discordError.code}`;
                }

                context.log.error('Error fetching or sending to D&D channel', errorDetails);
            }
        }

    } catch (error) {
        context.log.error('Error processing D&D messages', {
            error,
            gameId,
        });
    }
}
