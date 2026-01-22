import {
    TextChannel,
    DMChannel,
    NewsChannel,
    ThreadChannel,
    Client,
    Guild,
    EmbedBuilder,
    PermissionFlagsBits,
} from 'discord.js';
import { Context } from './types';

// Discord message character limit
const DISCORD_MESSAGE_LIMIT = 2000;

/**
 * Type for sendable Discord channels
 */
export type SendableChannel = TextChannel | DMChannel | NewsChannel | ThreadChannel;

/**
 * Safely sends a message to a Discord channel with comprehensive error handling
 * Returns true if successful, false otherwise
 */
export async function safelySendToChannel(
    channel: SendableChannel | null | undefined,
    content: string,
    context: Context,
    operationName: string = 'message send',
): Promise<boolean> {
    if (!channel) {
        context.log.warn(`${operationName} failed - channel is null/undefined`);
        return false;
    }

    try {
        // Validate channel still exists and bot has permissions
        if ('guild' in channel && channel.guild) {
            const botMember = channel.guild.members.cache.get(channel.client.user?.id || '');
            if (!botMember) {
                context.log.warn(`${operationName} failed - bot not in guild`, {
                    channelId: channel.id,
                    guildId: channel.guild.id,
                });
                return false;
            }

            const permissions = channel.permissionsFor(botMember);
            if (!permissions?.has(['SendMessages', 'ViewChannel'])) {
                context.log.warn(`${operationName} failed - insufficient permissions`, {
                    channelId: channel.id,
                    guildId: channel.guild.id,
                    hasViewChannel: permissions?.has('ViewChannel') || false,
                    hasSendMessages: permissions?.has('SendMessages') || false,
                });
                return false;
            }
        }

        // Attempt to send the message
        await channel.send(content);

        context.log.debug(`${operationName} successful`, {
            channelId: channel.id,
            messageLength: content.length,
        });

        return true;

    } catch (error) {
        // Handle specific Discord API errors
        if (error && typeof error === 'object' && 'code' in error) {
            const discordError = error as { code: number; message: string };

            switch (discordError.code) {
                case 10003: // Unknown Channel
                    context.log.warn(`${operationName} failed - channel no longer exists`, {
                        channelId: channel.id,
                        errorCode: discordError.code,
                        errorMessage: discordError.message,
                    });
                    break;

                case 50013: // Missing Permissions
                    context.log.warn(`${operationName} failed - missing permissions`, {
                        channelId: channel.id,
                        errorCode: discordError.code,
                        errorMessage: discordError.message,
                    });
                    break;

                case 50001: // Missing Access
                    context.log.warn(`${operationName} failed - missing access`, {
                        channelId: channel.id,
                        errorCode: discordError.code,
                        errorMessage: discordError.message,
                    });
                    break;

                default:
                    context.log.error(`${operationName} failed - Discord API error`, {
                        channelId: channel.id,
                        errorCode: discordError.code,
                        errorMessage: discordError.message,
                        error,
                    });
                    break;
            }
        } else {
            context.log.error(`${operationName} failed - unexpected error`, {
                channelId: channel.id,
                error,
            });
        }

        return false;
    }
}

/**
 * Safely finds a channel by name with optional type filtering
 */
export function safelyFindChannel(
    client: Client,
    channelName: string,
    channelTypeCheck: (channel: any) => channel is TextChannel,
    context?: Context,
): TextChannel | undefined {
    try {
        const channel = client.channels.cache.find((chan): chan is TextChannel =>
            channelTypeCheck(chan) && chan.name === channelName,
        );

        if (!channel && context) {
            context.log.debug('Channel not found', {
                channelName,
                availableChannels: client.channels.cache.size,
            });
        }

        return channel;
    } catch (error) {
        if (context) {
            context.log.error('Error finding channel', {
                channelName,
                error,
            });
        }
        return undefined;
    }
}

/**
 * Type guard for text channels
 */
export function isTextChannel(channel: any): channel is TextChannel {
    return channel?.type === 0; // ChannelType.GuildText
}

/**
 * Splits an oversized paragraph into smaller chunks, trying to break at sentence
 * boundaries first, then falling back to word boundaries.
 */
export function splitOversizedParagraph(
    paragraph: string,
    maxLength: number = DISCORD_MESSAGE_LIMIT,
): string[] {
    if (paragraph.length <= maxLength) {
        return [paragraph];
    }

    const chunks: string[] = [];

    // Try to split by sentences first (. ! ? followed by space or end)
    const sentences = paragraph.split(/(?<=[.!?])\s+/);
    let currentChunk = '';

    for (const sentence of sentences) {
        const trimmedSentence = sentence.trim();
        if (!trimmedSentence) {
            continue;
        }

        // If this single sentence is too long, split by words
        if (trimmedSentence.length > maxLength) {
            // Save current chunk first
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
                currentChunk = '';
            }

            // Split by words
            const words = trimmedSentence.split(/\s+/);
            let wordChunk = '';
            for (const word of words) {
                if (wordChunk.length + word.length + 1 > maxLength) {
                    if (wordChunk.trim()) {
                        chunks.push(wordChunk.trim());
                    }
                    wordChunk = word;
                } else {
                    wordChunk = wordChunk ? wordChunk + ' ' + word : word;
                }
            }
            if (wordChunk.trim()) {
                currentChunk = wordChunk.trim();
            }
        } else if (currentChunk.length + trimmedSentence.length + 1 > maxLength) {
            // Save current chunk and start new one with this sentence
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }
            currentChunk = trimmedSentence;
        } else {
            // Add sentence to current chunk
            currentChunk = currentChunk ? currentChunk + ' ' + trimmedSentence : trimmedSentence;
        }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Splits a long message into multiple chunks, respecting paragraph boundaries.
 * Will not split a paragraph in half - each chunk ends at a paragraph boundary.
 * If a single paragraph exceeds the limit, it will be split at sentence or word boundaries.
 */
export function splitMessageByParagraphs(
    content: string,
    maxLength: number = DISCORD_MESSAGE_LIMIT,
): string[] {
    if (content.length <= maxLength) {
        return [content];
    }

    const paragraphs = content.split(/\n\n+/);
    const chunks: string[] = [];
    let currentChunk = '';

    for (const paragraph of paragraphs) {
        const trimmedParagraph = paragraph.trim();
        if (!trimmedParagraph) {
            continue;
        }

        // If adding this paragraph would exceed the limit
        if (currentChunk.length + trimmedParagraph.length + 2 > maxLength) {
            // If we have content in the current chunk, save it
            if (currentChunk.trim()) {
                chunks.push(currentChunk.trim());
            }

            // If the paragraph itself is too long, split it further
            if (trimmedParagraph.length > maxLength) {
                const subChunks = splitOversizedParagraph(trimmedParagraph, maxLength);
                // Add all but last subchunk directly to chunks
                for (let i = 0; i < subChunks.length - 1; i++) {
                    chunks.push(subChunks[i]);
                }
                // Last subchunk becomes the current chunk (may combine with next paragraph)
                currentChunk = subChunks[subChunks.length - 1] || '';
            } else {
                currentChunk = trimmedParagraph;
            }
        } else {
            // Add paragraph to current chunk
            if (currentChunk) {
                currentChunk += '\n\n' + trimmedParagraph;
            } else {
                currentChunk = trimmedParagraph;
            }
        }
    }

    // Don't forget the last chunk
    if (currentChunk.trim()) {
        chunks.push(currentChunk.trim());
    }

    return chunks;
}

/**
 * Sends a long message as multiple Discord messages, splitting at paragraph boundaries.
 * Returns true if all messages were sent successfully, false if any failed.
 */
export async function sendLongMessage(
    channel: SendableChannel | null | undefined,
    content: string,
    context: Context,
    operationName: string = 'long message send',
    delayMs: number = 100,
): Promise<boolean> {
    const chunks = splitMessageByParagraphs(content);

    context.log.debug(`${operationName} - splitting into ${chunks.length} messages`, {
        channelId: channel?.id,
        originalLength: content.length,
        chunkCount: chunks.length,
        chunkLengths: chunks.map(c => c.length),
    });

    for (let i = 0; i < chunks.length; i++) {
        const success = await safelySendToChannel(
            channel,
            chunks[i],
            context,
            `${operationName} (part ${i + 1}/${chunks.length})`,
        );

        if (!success) {
            context.log.error(`${operationName} failed at part ${i + 1}/${chunks.length}`, {
                channelId: channel?.id,
            });
            return false;
        }

        // Small delay between messages to avoid rate limiting
        if (i < chunks.length - 1 && delayMs > 0) {
            await new Promise(resolve => setTimeout(resolve, delayMs));
        }
    }

    return true;
}

/**
 * Enhanced channel operations with automatic retry logic
 */
export async function sendWithRetry(
    channel: SendableChannel | null | undefined,
    content: string,
    context: Context,
    maxRetries: number = 2,
    retryDelay: number = 1000,
): Promise<boolean> {
    for (let attempt = 1; attempt <= maxRetries; attempt++) {
        const success = await safelySendToChannel(
            channel,
            content,
            context,
            `message send (attempt ${attempt}/${maxRetries})`,
        );

        if (success) {
            return true;
        }

        if (attempt < maxRetries) {
            context.log.debug(`Retrying channel send after delay`, {
                attempt,
                maxRetries,
                retryDelay,
            });
            await new Promise(resolve => setTimeout(resolve, retryDelay));
        }
    }

    return false;
}

/**
 * Gets the configured log channel ID for a guild.
 * This is the generic bot log channel used by all features.
 */
export async function getLogChannelId(
    tables: Context['tables'],
    guildId: string,
): Promise<string | null> {
    const config = await tables.Config.findOne({
        where: { key: `log_channel_${guildId}` },
    });
    return config?.value || null;
}

/**
 * Gets the log channel for a guild if configured and accessible.
 * Returns null if not configured or bot lacks permissions.
 * Fetches channel from Discord API if not in cache to handle deleted channels.
 */
export async function getLogChannel(
    guild: Guild,
    tables: Context['tables'],
    log: Context['log'],
): Promise<TextChannel | null> {
    const logChannelId = await getLogChannelId(tables, guild.id);

    if (!logChannelId) {
        log.debug({ guildId: guild.id }, 'No log channel configured');
        return null;
    }

    // Try cache first, then fetch from Discord API
    let logChannel = guild.channels.cache.get(logChannelId) as TextChannel | undefined;

    if (!logChannel) {
        try {
            // Fetch from Discord API to verify channel still exists
            const fetchedChannel = await guild.channels.fetch(logChannelId);
            if (fetchedChannel && fetchedChannel.isTextBased()) {
                logChannel = fetchedChannel as TextChannel;
            }
        } catch {
            // Channel doesn't exist or bot lacks access
            log.warn({ logChannelId, guildId: guild.id }, 'Log channel not found - may have been deleted');
            return null;
        }
    }

    if (!logChannel || !logChannel.isTextBased()) {
        log.warn({ logChannelId, guildId: guild.id }, 'Log channel not found or not text-based');
        return null;
    }

    const botMember = guild.members.me;
    if (!botMember || !logChannel.permissionsFor(botMember)?.has(PermissionFlagsBits.SendMessages)) {
        log.warn({ logChannelId, guildId: guild.id }, 'Bot lacks SendMessages permission in log channel');
        return null;
    }

    return logChannel;
}

/**
 * Sends a log message to the guild's configured log channel.
 * Handles all error cases gracefully.
 */
export async function sendLogMessage(
    guild: Guild,
    tables: Context['tables'],
    log: Context['log'],
    options: {
        embeds?: EmbedBuilder[];
        content?: string;
    },
): Promise<boolean> {
    try {
        const logChannel = await getLogChannel(guild, tables, log);

        if (!logChannel) {
            return false;
        }

        await logChannel.send({
            content: options.content,
            embeds: options.embeds,
        });

        log.debug({ guildId: guild.id }, 'Sent log message');
        return true;
    } catch (error) {
        log.error({ error, guildId: guild.id }, 'Failed to send log message');
        return false;
    }
}
