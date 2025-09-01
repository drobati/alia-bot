import { TextChannel, DMChannel, NewsChannel, ThreadChannel, Client } from 'discord.js';
import { Context } from './types';

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
