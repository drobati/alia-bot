import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import config from "config";

/**
 * Categorizes Discord API errors for better Sentry organization
 */
function getDiscordErrorCategory(errorCode: number): string {
    switch (errorCode) {
        case 10003: // Unknown Channel
        case 10013: // Unknown User
        case 10007: // Unknown Member
        case 10008: // Unknown Message
        case 10014: // Unknown Application
            return 'resource_not_found';

        case 50013: // Missing Permissions
        case 50001: // Missing Access
        case 50014: // Only bots can use this endpoint
            return 'permissions';

        case 50035: // Invalid Form Body
        case 50006: // Cannot send empty message
        case 50033: // Invalid Recipient(s)
            return 'validation';

        case 30001: // Maximum number of guilds reached
        case 30003: // Maximum number of friends reached
        case 30005: // Maximum number of reactions reached
            return 'rate_limits';

        case 40001: // Unauthorized
        case 40002: // Verify your email
        case 40003: // Rate limited
            return 'authentication';

        default:
            return 'unknown';
    }
}

export function initializeSentry() {
    const sentryDsn = process.env.SENTRY_DSN;

    if (!sentryDsn) {
        // eslint-disable-next-line no-console
        console.warn("SENTRY_DSN environment variable not set. Sentry logging disabled.");
        return;
    }

    Sentry.init({
        dsn: sentryDsn,
        environment: process.env.NODE_ENV || "development",
        integrations: [
            nodeProfilingIntegration(),
            // Enable console logging integration for testing
            Sentry.consoleLoggingIntegration({ 
                levels: ["log", "warn", "error"] 
            }),
        ],
        // Enable Sentry Logs feature
        enableLogs: true,
        // Enable debug mode only in development
        debug: process.env.NODE_ENV === 'development',
        // Performance Monitoring
        tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
        // Release Tracking - prioritize VERSION from deployment, fallback to COMMIT_SHA, then 'unknown'
        release: process.env.VERSION || process.env.COMMIT_SHA || "unknown",
        // Set sample rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: 0.1,
        // Additional context
        beforeSend(event) {
            // Add bot-specific context to all events
            if (event.extra) {
                event.extra.botVersion = process.env.VERSION || '2.0.0';
                event.extra.nodeEnv = process.env.NODE_ENV;
                event.extra.botOwnerId = config.get('owner');
            }

            // Enhanced Discord API error handling
            if (event.exception?.values?.[0]) {
                const exception = event.exception.values[0];
                const errorMessage = exception.value || '';

                // Parse Discord API errors
                const discordApiErrorMatch = errorMessage.match(/DiscordAPIError\[(\d+)\]: (.+)/);
                if (discordApiErrorMatch) {
                    const [, errorCode, errorDescription] = discordApiErrorMatch;

                    // Add structured Discord error data
                    event.tags = {
                        ...event.tags,
                        discord_api_error: 'true',
                        discord_error_code: errorCode,
                        error_type: 'discord_api',
                    };

                    event.extra = {
                        ...event.extra,
                        discord_error_code: parseInt(errorCode),
                        discord_error_description: errorDescription,
                        discord_error_category: getDiscordErrorCategory(parseInt(errorCode)),
                    };

                    // Set appropriate level based on error severity
                    switch (parseInt(errorCode)) {
                        case 10003: // Unknown Channel
                        case 10013: // Unknown User
                        case 10007: // Unknown Member
                            event.level = 'warning'; // These are often expected in Discord bots
                            break;
                        case 50013: // Missing Permissions
                        case 50001: // Missing Access
                            event.level = 'warning';
                            break;
                        case 50035: // Invalid Form Body
                        case 50006: // Cannot send empty message
                            event.level = 'error';
                            break;
                        default:
                            event.level = 'error';
                    }
                }
            }

            return event;
        },
        // Add Discord bot specific tags
        initialScope: {
            tags: {
                component: 'discord-bot',
                service: 'alia-bot',
            },
        },
    });

    // eslint-disable-next-line no-console
    console.log(`Sentry initialized for environment: ${process.env.NODE_ENV}`);
}

// Helper function to capture owner ID debugging info to Sentry
export function captureOwnerIdDebug(data: {
    command?: string;
    userId: string;
    username?: string;
    configuredOwnerId: string;
    isOwner: boolean;
    event: string; // 'permission_check', 'login', 'deploy', etc.
}) {
    Sentry.addBreadcrumb({
        message: `Owner ID Debug: ${data.event}`,
        category: 'auth',
        level: 'info',
        data: {
            command: data.command,
            userId: data.userId,
            username: data.username,
            configuredOwnerId: data.configuredOwnerId,
            isOwner: data.isOwner,
            event: data.event,
            exactMatch: data.userId === data.configuredOwnerId,
            comparison: `"${data.userId}" === "${data.configuredOwnerId}"`,
        },
    });

    // If there's a mismatch, capture it as a message
    if (!data.isOwner && data.event === 'permission_check') {
        Sentry.captureMessage(`Owner ID mismatch detected`, 'warning');
    }
}

// Helper function to set user context
export function setSentryUserContext(userId: string, username?: string, isOwner?: boolean) {
    Sentry.setUser({
        id: userId,
        username: username,
        isOwner: isOwner,
    });
}

export { Sentry };