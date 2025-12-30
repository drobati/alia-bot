import { Client, TextChannel, DMChannel, NewsChannel } from 'discord.js';
import { Context } from '../../types';
import { EventType, EventPayload, ScheduledEventAttributes } from '../../models/scheduledEvent';

/**
 * Context passed to event handlers when executing
 */
export interface EventContext {
    event: ScheduledEventAttributes;
    client: Client;
    context: Context;
    channel: TextChannel | DMChannel | NewsChannel | null;
    payload: EventPayload;
}

/**
 * Result of executing an event handler
 */
export interface EventResult {
    success: boolean;
    message?: string;
    shouldReschedule?: boolean; // For recurring events
    error?: Error;
}

/**
 * Validation result for event payloads
 */
export interface ValidationResult {
    valid: boolean;
    error?: string;
}

/**
 * Event handler interface - each event type implements this
 */
/* eslint-disable no-unused-vars */
export interface EventHandler {
    type: EventType;

    /**
     * Execute the event action (send reminder, birthday message, etc.)
     */
    execute(ctx: EventContext): Promise<EventResult>;

    /**
     * Validate the payload before scheduling
     */
    validate?(payload: unknown): ValidationResult;

    /**
     * Format the event for display (e.g., in /remind list)
     */
    formatDisplay?(event: ScheduledEventAttributes): string;
}
/* eslint-enable no-unused-vars */

/**
 * Options for creating a new scheduled event
 */
export interface CreateEventOptions {
    guildId: string;
    channelId?: string | null;
    creatorId: string;
    eventType: EventType;
    payload: EventPayload;
    scheduleType: 'once' | 'recurring' | 'cron';
    executeAt?: Date;
    cronSchedule?: string;
    timezone?: string;
    maxExecutions?: number;
    metadata?: Record<string, unknown>;
}

/**
 * Options for listing scheduled events
 */
export interface ListEventOptions {
    eventType?: EventType;
    creatorId?: string;
    status?: string;
    limit?: number;
}
