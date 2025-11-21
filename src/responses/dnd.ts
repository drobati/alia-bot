import { Message } from 'discord.js';
import { Context } from '../utils/types';
import { DndGameAttributes } from '../types/database';
import { safelySendToChannel } from '../utils/discordHelpers';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Discord message character limit
const DISCORD_MESSAGE_LIMIT = 2000;

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

        // Generate response using OpenAI
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });

        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: game.systemPrompt },
            ...(game.conversationHistory as ChatCompletionMessageParam[] || []),
            { role: 'system', content: 'CRITICAL: Your response MUST be under 2000 characters total. This is a hard Discord limit. Be concise and descriptive.' },
            { role: 'user', content: userPrompt },
        ];

        context.log.info('Sending D&D prompt to OpenAI', {
            gameId,
            gameName: game.name,
            messageCount: messages.length,
            userPromptLength: userPrompt.length,
        });

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages,
            max_tokens: 500,
            temperature: 0.8,
        });

        let response = completion.choices[0].message.content;

        if (!response) {
            context.log.error('No response from OpenAI', { gameId, gameName: game.name });
            return;
        }

        // Truncate response if it exceeds Discord's message limit
        const originalLength = response.length;
        if (response.length > DISCORD_MESSAGE_LIMIT) {
            // Truncate and add indicator that message was cut off
            response = response.substring(0, DISCORD_MESSAGE_LIMIT - 20) + '\n\n*[truncated]*';
            context.log.warn('D&D response truncated to fit Discord limit', {
                gameId,
                gameName: game.name,
                originalLength,
                truncatedLength: response.length,
            });
        }

        context.log.info('Received D&D response from OpenAI', {
            gameId,
            gameName: game.name,
            responseLength: response.length,
            originalLength,
            wasTruncated: originalLength > DISCORD_MESSAGE_LIMIT,
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

        // Send response to channel
        if (game.channelId && context.client) {
            try {
                const channel = await context.client.channels.fetch(game.channelId);

                if (channel && 'send' in channel) {
                    const success = await safelySendToChannel(
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
