import * as Sentry from "@sentry/node";
import { nodeProfilingIntegration } from "@sentry/profiling-node";
import config from "config";

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
        ],
        // Performance Monitoring
        tracesSampleRate: 0.1, // 10% of transactions for performance monitoring
        // Release Tracking
        release: process.env.COMMIT_SHA || "unknown",
        // Set sample rate for profiling - this is relative to tracesSampleRate
        profilesSampleRate: 0.1,
        // Additional context
        beforeSend(event) {
            // Add bot-specific context to all events
            if (event.extra) {
                event.extra.botVersion = config.get('version') || '2.0.0';
                event.extra.nodeEnv = process.env.NODE_ENV;
                event.extra.botOwnerId = config.get('owner');
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