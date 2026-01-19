import {
    Message,
    EmbedBuilder,
    ActionRowBuilder,
    ButtonBuilder,
    ButtonStyle,
    TextChannel,
} from 'discord.js';
import { Context } from '../utils/types';
import { DndGameAttributes, SkillCheckData, SkillCheckVote } from '../types/database';
import { sendLongMessage } from '../utils/discordHelpers';
import type { ChatCompletionMessageParam } from 'openai/resources/chat/completions';

// Track message collection timers per game
const messageTimers = new Map<number, NodeJS.Timeout>();
// Track skill check voting timers per game
const skillCheckTimers = new Map<number, NodeJS.Timeout>();

// Skill check voting duration in seconds
const SKILL_CHECK_VOTE_DURATION = 60;

// Option labels for skill check buttons
const OPTION_LABELS = ['A', 'B', 'C', 'D'];

/**
 * Parse skill check data from AI response
 * Returns the skill check data and the response text with skill check removed
 */
function parseSkillCheck(response: string): { skillCheck: SkillCheckData | null; cleanResponse: string } {
    const skillCheckRegex = /\[SKILL_CHECK\]\s*([\s\S]*?)\s*\[\/SKILL_CHECK\]/;
    const match = response.match(skillCheckRegex);

    if (!match) {
        return { skillCheck: null, cleanResponse: response };
    }

    try {
        const jsonStr = match[1].trim();
        const skillCheck = JSON.parse(jsonStr) as SkillCheckData;

        // Validate the skill check data
        if (!skillCheck.skill || !skillCheck.difficulty || !skillCheck.description ||
            !Array.isArray(skillCheck.options) || skillCheck.options.length !== 4) {
            return { skillCheck: null, cleanResponse: response };
        }

        // Remove the skill check block from the response
        const cleanResponse = response.replace(skillCheckRegex, '').trim();

        return { skillCheck, cleanResponse };
    } catch {
        return { skillCheck: null, cleanResponse: response };
    }
}

/**
 * Create skill check voting embed and buttons
 */
function createSkillCheckEmbed(
    skillCheck: SkillCheckData,
    gameId: number,
    gameName: string,
    votes: Record<string, SkillCheckVote> = {},
): { embed: EmbedBuilder; row: ActionRowBuilder<ButtonBuilder> } {
    // Count votes per option
    const voteCounts = [0, 0, 0, 0];
    for (const vote of Object.values(votes)) {
        if (vote.optionIndex >= 0 && vote.optionIndex < 4) {
            voteCounts[vote.optionIndex]++;
        }
    }

    const totalVotes = Object.keys(votes).length;

    const optionsText = skillCheck.options
        .map((opt, i) => {
            const voteCount = voteCounts[i];
            const voteText = voteCount > 0 ? ` (${voteCount} vote${voteCount !== 1 ? 's' : ''})` : '';
            return `**${OPTION_LABELS[i]}.** ${opt.label}${voteText}\n*${opt.description}*`;
        })
        .join('\n\n');

    const embed = new EmbedBuilder()
        .setColor(0x9B59B6)
        .setTitle(`🎲 ${skillCheck.skill} Check (${skillCheck.difficulty})`)
        .setDescription(`${skillCheck.description}\n\n${optionsText}`)
        .addFields({
            name: 'Voting',
            value: `${totalVotes} vote${totalVotes !== 1 ? 's' : ''} cast - Click a button to vote!`,
        })
        .setFooter({ text: `${gameName} | Vote ends in ${SKILL_CHECK_VOTE_DURATION} seconds` })
        .setTimestamp();

    // Create voting buttons
    const buttons = skillCheck.options.map((_, index) =>
        new ButtonBuilder()
            .setCustomId(`dnd_skill_${gameId}_${index}`)
            .setLabel(OPTION_LABELS[index])
            .setStyle(ButtonStyle.Primary),
    );

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);

    return { embed, row };
}

/**
 * Create disabled skill check buttons showing results
 */
function createSkillCheckResultButtons(
    skillCheck: SkillCheckData,
    winningIndex: number,
    gameId: number,
): ActionRowBuilder<ButtonBuilder> {
    const buttons = skillCheck.options.map((_, index) => {
        const isWinner = index === winningIndex;
        return new ButtonBuilder()
            .setCustomId(`dnd_skill_ended_${gameId}_${index}`)
            .setLabel(OPTION_LABELS[index])
            .setStyle(isWinner ? ButtonStyle.Success : ButtonStyle.Secondary)
            .setDisabled(true);
    });

    return new ActionRowBuilder<ButtonBuilder>().addComponents(buttons);
}

/**
 * Resolve skill check votes and continue the story
 */
export async function resolveSkillCheck(gameId: number, context: Context): Promise<void> {
    try {
        // Clear the timer
        skillCheckTimers.delete(gameId);

        // Fetch latest game state
        const game = await context.tables.DndGame.findOne({
            where: { id: gameId },
        }) as unknown as DndGameAttributes | null;

        if (!game || !game.pendingSkillCheck || !game.channelId) {
            context.log.debug('No skill check to resolve', { gameId });
            return;
        }

        const skillCheck = game.pendingSkillCheck;
        const votes = game.skillCheckVotes || {};

        context.log.info('Resolving D&D skill check', {
            gameId,
            gameName: game.name,
            totalVotes: Object.keys(votes).length,
        });

        // Count votes per option
        const voteCounts = [0, 0, 0, 0];
        for (const vote of Object.values(votes)) {
            if (vote.optionIndex >= 0 && vote.optionIndex < 4) {
                voteCounts[vote.optionIndex]++;
            }
        }

        // Find winning option (highest votes, or random if tie/no votes)
        let winningIndex = 0;
        let maxVotes = voteCounts[0];

        // Find all options with the max vote count
        const tiedOptions: number[] = [0];
        for (let i = 1; i < 4; i++) {
            if (voteCounts[i] > maxVotes) {
                maxVotes = voteCounts[i];
                winningIndex = i;
                tiedOptions.length = 0;
                tiedOptions.push(i);
            } else if (voteCounts[i] === maxVotes) {
                tiedOptions.push(i);
            }
        }

        // If there's a tie (including no votes), pick randomly from tied options
        if (tiedOptions.length > 1) {
            winningIndex = tiedOptions[Math.floor(Math.random() * tiedOptions.length)];
        }

        const winningOption = skillCheck.options[winningIndex];

        context.log.info('Skill check winner determined', {
            gameId,
            winningIndex,
            winningOption: winningOption.label,
            voteCounts,
            wasTie: tiedOptions.length > 1,
        });

        // Update the skill check message to show results
        if (game.skillCheckMessageId && context.client) {
            try {
                const channel = await context.client.channels.fetch(game.channelId) as TextChannel;
                if (channel) {
                    const message = await channel.messages.fetch(game.skillCheckMessageId);
                    if (message) {
                        const resultsEmbed = new EmbedBuilder()
                            .setColor(0x2ECC71)
                            .setTitle(`🎲 ${skillCheck.skill} Check - Results`)
                            .setDescription(
                                `**Winner: ${OPTION_LABELS[winningIndex]}. ${winningOption.label}**\n` +
                                `*${winningOption.description}*\n\n` +
                                skillCheck.options.map((opt, i) => {
                                    const count = voteCounts[i];
                                    const marker = i === winningIndex ? '✅' : '⬜';
                                    const voteWord = count !== 1 ? 's' : '';
                                    return `${marker} **${OPTION_LABELS[i]}.** ${opt.label} - ${count} vote${voteWord}`;
                                }).join('\n'),
                            )
                            .setFooter({ text: `${game.name} | Voting complete` })
                            .setTimestamp();

                        const disabledRow = createSkillCheckResultButtons(skillCheck, winningIndex, gameId);

                        await message.edit({
                            embeds: [resultsEmbed],
                            components: [disabledRow],
                        });
                    }
                }
            } catch (editError) {
                context.log.error('Failed to update skill check message', { error: editError, gameId });
            }
        }

        // Clear skill check state from game
        await context.tables.DndGame.update(
            {
                pendingSkillCheck: null as any,
                skillCheckVotes: null as any,
                skillCheckMessageId: null as any,
                skillCheckExpiresAt: null as any,
            },
            { where: { id: gameId } },
        );

        // Generate continuation based on chosen option
        const OpenAI = (await import('openai')).default;
        const openai = new OpenAI({
            apiKey: process.env.OPENAI_API_KEY || '',
        });

        // Add the skill check result to conversation
        const choicePrompt = `The party chose: "${winningOption.label}" - ` +
            `${winningOption.description}. Continue the story based on this choice ` +
            `and the ${skillCheck.skill} check (${skillCheck.difficulty}).`;

        const messages: ChatCompletionMessageParam[] = [
            { role: 'system', content: game.systemPrompt },
            ...(game.conversationHistory as ChatCompletionMessageParam[] || []),
            { role: 'user', content: choicePrompt },
        ];

        const completion = await openai.chat.completions.create({
            model: 'gpt-4-turbo-preview',
            messages,
            max_tokens: 500,
            temperature: 0.8,
        });

        const continuation = completion.choices[0].message.content;

        if (!continuation) {
            context.log.error('No continuation from OpenAI', { gameId });
            return;
        }

        // Check if continuation also has a skill check
        const { skillCheck: newSkillCheck, cleanResponse: cleanContinuation } = parseSkillCheck(continuation);

        // Update conversation history
        const updatedHistory = [
            ...(game.conversationHistory || []),
            { role: 'user' as const, content: choicePrompt },
            { role: 'assistant' as const, content: continuation },
        ];

        // Keep only last 20 messages
        const trimmedHistory = updatedHistory.slice(-20);

        // Update game state
        await context.tables.DndGame.update(
            {
                conversationHistory: trimmedHistory as any,
                currentRound: game.currentRound + 1,
                lastResponseTime: new Date(),
            },
            { where: { id: gameId } },
        );

        // Send continuation to channel
        if (context.client) {
            const channel = await context.client.channels.fetch(game.channelId) as TextChannel;
            if (channel) {
                await sendLongMessage(
                    channel as any,
                    cleanContinuation,
                    context,
                    'D&D skill check continuation',
                );

                // If continuation has a new skill check, create voting message
                if (newSkillCheck) {
                    await createSkillCheckVoting(game.id!, game.name, newSkillCheck, channel, context);
                }
            }
        }

        context.log.info('Skill check resolved and story continued', {
            gameId,
            gameName: game.name,
            winningOption: winningOption.label,
            hasNewSkillCheck: !!newSkillCheck,
        });

    } catch (error) {
        context.log.error('Error resolving skill check', { error, gameId });
    }
}

/**
 * Create a skill check voting message in the channel
 */
async function createSkillCheckVoting(
    gameId: number,
    gameName: string,
    skillCheck: SkillCheckData,
    channel: TextChannel,
    context: Context,
): Promise<void> {
    const { embed, row } = createSkillCheckEmbed(skillCheck, gameId, gameName);

    const voteMessage = await channel.send({
        embeds: [embed],
        components: [row],
    });

    // Calculate expiration time
    const expiresAt = new Date(Date.now() + SKILL_CHECK_VOTE_DURATION * 1000);

    // Save skill check state to database
    await context.tables.DndGame.update(
        {
            pendingSkillCheck: skillCheck as any,
            skillCheckVotes: {} as any,
            skillCheckMessageId: voteMessage.id,
            skillCheckExpiresAt: expiresAt,
        },
        { where: { id: gameId } },
    );

    // Set timer to resolve votes
    const timer = setTimeout(async () => {
        await resolveSkillCheck(gameId, context);
    }, SKILL_CHECK_VOTE_DURATION * 1000);

    skillCheckTimers.set(gameId, timer);

    context.log.info('Skill check voting created', {
        gameId,
        gameName,
        skill: skillCheck.skill,
        difficulty: skillCheck.difficulty,
        expiresAt: expiresAt.toISOString(),
    });
}

// Export for use in interactionCreate handler
export { createSkillCheckEmbed, OPTION_LABELS, skillCheckTimers };

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

        const response = completion.choices[0].message.content;

        if (!response) {
            context.log.error('No response from OpenAI', { gameId, gameName: game.name });
            return;
        }

        // Parse skill check from response
        const { skillCheck, cleanResponse } = parseSkillCheck(response);

        context.log.info('Received D&D response from OpenAI', {
            gameId,
            gameName: game.name,
            responseLength: response.length,
            tokensUsed: completion.usage?.total_tokens,
            hasSkillCheck: !!skillCheck,
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
                const channel = await context.client.channels.fetch(game.channelId) as TextChannel;

                if (channel && 'send' in channel) {
                    // Send the clean response (without skill check block)
                    const success = await sendLongMessage(
                        channel as any,
                        cleanResponse,
                        context,
                        'D&D response',
                    );

                    if (success) {
                        context.log.info('D&D response sent successfully', {
                            gameId,
                            gameName: game.name,
                            round: game.currentRound + 1,
                            responseLength: cleanResponse.length,
                        });

                        // If there's a skill check, create voting message
                        if (skillCheck) {
                            await createSkillCheckVoting(gameId, game.name, skillCheck, channel, context);
                        }
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
