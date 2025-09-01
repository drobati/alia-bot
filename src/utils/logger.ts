import bunyan from 'bunyan';
import config from 'config';
import { Sentry } from '../lib/sentry';

/**
 * Send logs directly to Sentry Logs using the native v10 logger API
 */
function sendToSentryLogs(level: string, message: string, data: Record<string, any>) {
    try {
        // Use Sentry's native logger API (available in v10+)
        const logger = Sentry.logger;

        switch (level) {
            case 'debug':
                logger.debug(message, data);
                break;
            case 'info':
                logger.info(message, data);
                break;
            case 'warning':
                logger.warn(message, data);
                break;
            case 'error':
                logger.error(message, data);
                break;
            default:
                logger.info(message, data);
        }
    } catch (error) {
        // eslint-disable-next-line no-console
        console.error('[SentryLogs] Error sending log to Sentry:', error);
    }
}

/**
 * Custom Bunyan stream that forwards logs to both Sentry Issues and Sentry Logs
 */
class SentryBunyanStream {
    write(record: any) {
        // Parse the record if it's a string (shouldn't happen with Bunyan, but safety)
        const logRecord = typeof record === 'string' ? JSON.parse(record) : record;

        const {
            level,
            msg,
            err,
            error,
            userId,
            username,
            channelId,
            guildId,
            command,
            ...extra
        } = logRecord;

        // Map Bunyan levels to Sentry levels
        let sentryLevel: 'debug' | 'info' | 'warning' | 'error' | 'fatal' = 'info';

        switch (level) {
            case 10: // TRACE
                sentryLevel = 'debug';
                break;
            case 20: // DEBUG
                sentryLevel = 'debug';
                break;
            case 30: // INFO
                sentryLevel = 'info';
                break;
            case 40: // WARN
                sentryLevel = 'warning';
                break;
            case 50: // ERROR
                sentryLevel = 'error';
                break;
            case 60: // FATAL
                sentryLevel = 'fatal';
                break;
            default:
                sentryLevel = 'info';
        }

        // Set user context if available
        if (userId || username) {
            Sentry.setUser({
                id: userId,
                username: username,
            });
        }

        // Add tags for better organization
        const tags: Record<string, string> = {
            log_level: bunyan.nameFromLevel[level] || 'unknown',
        };

        if (channelId) {tags.channel_id = channelId;}
        if (guildId) {tags.guild_id = guildId;}
        if (command) {tags.command = command;}

        Sentry.setTags(tags);

        // Add extra context
        if (Object.keys(extra).length > 0) {
            Sentry.setExtra('log_context', extra);
        }

        try {
            // Send ALL logs to Sentry Logs via direct API
            let sentryLogLevel = 'info';
            switch (level) {
                case 10: // TRACE
                case 20: // DEBUG
                    sentryLogLevel = 'debug';
                    break;
                case 30: // INFO
                    sentryLogLevel = 'info';
                    break;
                case 40: // WARN
                    sentryLogLevel = 'warning';
                    break;
                case 50: // ERROR
                case 60: // FATAL
                    sentryLogLevel = 'error';
                    break;
            }

            // Send to Sentry Logs with full context
            sendToSentryLogs(sentryLogLevel, msg || 'Log message', {
                bunyan_level: bunyan.nameFromLevel[level] || 'unknown',
                userId,
                username,
                channelId,
                guildId,
                command,
                error: err || error,
                timestamp: new Date().toISOString(),
                ...extra,
            });

            // ALSO send errors and important events to Sentry Issues (existing behavior)
            const errorObject = err || error;
            if (errorObject && sentryLevel === 'error') {
                // For error levels, capture as exception
                if (errorObject instanceof Error) {
                    Sentry.captureException(errorObject);
                } else {
                    Sentry.captureException(new Error(msg || 'Unknown error'), {
                        extra: { original_error: errorObject },
                    });
                }
            } else if (sentryLevel === 'warning' || sentryLevel === 'error') {
                // For warnings and non-exception errors, capture as message
                Sentry.captureMessage(msg || 'Log message', sentryLevel);
            } else if (sentryLevel === 'info' && (
                msg?.includes('deployed') ||
                msg?.includes('initialized') ||
                msg?.includes('started') ||
                msg?.includes('shutdown')
            )) {
                // Capture important operational messages as breadcrumbs
                Sentry.addBreadcrumb({
                    message: msg,
                    level: sentryLevel,
                    category: 'system',
                    data: extra,
                });
            } else if (sentryLevel === 'info' && (
                msg?.includes('CONFIG DEBUG') ||
                msg?.includes('Owner ID') ||
                msg?.includes('NODE_ENV') ||
                msg?.includes('Config sources') ||
                msg?.includes('config keys')
            )) {
                // Send config debug logs as messages so they appear in events list
                Sentry.captureMessage(msg || 'Config debug log', 'info');
            } else {
                // For debug/trace, just add as breadcrumb for context
                Sentry.addBreadcrumb({
                    message: msg,
                    level: sentryLevel,
                    category: 'log',
                    data: extra,
                });
            }
        } catch (sentryError) {
            // eslint-disable-next-line no-console
            console.error('[SentryStream] Error sending to Sentry:', sentryError);
        }
    }
}

/**
 * Enhanced logger factory with Sentry integration
 */
export function createLogger(name: string, additionalStreams: bunyan.Stream[] = []): bunyan {
    const streams: bunyan.Stream[] = [
        {
            level: config.get<string>('level') as bunyan.LogLevel,
            stream: process.stdout,
        },
    ];

    // Add Sentry stream when DSN is configured
    if (process.env.SENTRY_DSN) {
        const sentryLevel = process.env.NODE_ENV === 'production' ? 'warn' : 'info';

        streams.push({
            level: sentryLevel as bunyan.LogLevel,
            stream: new SentryBunyanStream(),
            type: 'raw', // Use raw mode to get the full record object
        });
    }

    // Add any additional streams
    streams.push(...additionalStreams);

    return bunyan.createLogger({
        name,
        streams,
        serializers: {
            ...bunyan.stdSerializers,
            // Custom serializer for Discord objects
            discordUser: (user: any) => ({
                id: user?.id,
                username: user?.username,
                discriminator: user?.discriminator,
                bot: user?.bot,
            }),
            discordChannel: (channel: any) => ({
                id: channel?.id,
                name: channel?.name,
                type: channel?.type,
                guildId: channel?.guild?.id,
            }),
            discordGuild: (guild: any) => ({
                id: guild?.id,
                name: guild?.name,
                memberCount: guild?.memberCount,
            }),
        },
    });
}

/**
 * Structured logging helpers for common Discord bot operations
 */
export class BotLogger {
    private logger: bunyan;

    constructor(name: string, additionalStreams?: bunyan.Stream[]) {
        this.logger = createLogger(name, additionalStreams);
    }

    // Expose all standard bunyan methods - delegate directly to bunyan
    trace(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.logger.trace as any)(...args);
    }

    debug(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.logger.debug as any)(...args);
    }

    info(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.logger.info as any)(...args);
    }

    warn(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.logger.warn as any)(...args);
    }

    error(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.logger.error as any)(...args);
    }

    fatal(...args: any[]): void {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-unsafe-member-access
        (this.logger.fatal as any)(...args);
    }

    // Enhanced Discord-specific logging methods
    logCommand(data: {
        command: string;
        userId: string;
        username?: string;
        guildId?: string;
        channelId?: string;
        args?: any;
        success: boolean;
        duration?: number;
        error?: Error;
    }): void {
        const baseLog = {
            command: data.command,
            userId: data.userId,
            username: data.username,
            guildId: data.guildId,
            channelId: data.channelId,
            args: data.args,
            duration: data.duration,
            category: 'command_execution',
        };

        if (data.success) {
            this.info(baseLog, `Command ${data.command} executed successfully`);
        } else {
            this.error({
                ...baseLog,
                error: data.error,
            }, `Command ${data.command} failed`);
        }
    }

    logDiscordEvent(data: {
        event: string;
        userId?: string;
        username?: string;
        guildId?: string;
        channelId?: string;
        details?: any;
    }): void {
        this.info({
            event: data.event,
            userId: data.userId,
            username: data.username,
            guildId: data.guildId,
            channelId: data.channelId,
            details: data.details,
            category: 'discord_event',
        }, `Discord event: ${data.event}`);
    }

    logApiCall(data: {
        service: string;
        endpoint: string;
        method: string;
        status: number;
        duration: number;
        userId?: string;
        error?: Error;
    }): void {
        const baseLog = {
            service: data.service,
            endpoint: data.endpoint,
            method: data.method,
            status: data.status,
            duration: data.duration,
            userId: data.userId,
            category: 'api_call',
        };

        if (data.status >= 400 || data.error) {
            this.error({
                ...baseLog,
                error: data.error,
            }, `API call to ${data.service} failed`);
        } else {
            this.info(baseLog, `API call to ${data.service} successful`);
        }
    }

    logDatabaseOperation(data: {
        operation: string;
        table: string;
        duration?: number;
        recordsAffected?: number;
        userId?: string;
        error?: Error;
    }): void {
        const baseLog = {
            operation: data.operation,
            table: data.table,
            duration: data.duration,
            recordsAffected: data.recordsAffected,
            userId: data.userId,
            category: 'database_operation',
        };

        if (data.error) {
            this.error({
                ...baseLog,
                error: data.error,
            }, `Database ${data.operation} on ${data.table} failed`);
        } else {
            this.debug(baseLog, `Database ${data.operation} on ${data.table} completed`);
        }
    }

    // Create child logger with additional context
    child(obj: any): BotLogger {
        const childLogger = new BotLogger('child');
        childLogger.logger = this.logger.child(obj);
        return childLogger;
    }
}

/**
 * Default application logger instance
 */
export const logger = new BotLogger('alia-bot');