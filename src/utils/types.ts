/* eslint-disable no-unused-vars */
import { Sequelize } from 'sequelize';
import { DatabaseTables } from '../types/database';
import { BotLogger } from './logger';

// Forward declaration to avoid circular dependency
export interface MotivationalScheduler {
    updateSchedule: (channelId: string) => Promise<void>;
    removeSchedule: (channelId: string) => Promise<void>;
}

export interface VoiceService {
    joinVoiceChannel: (channel: any) => Promise<any>;
    leaveVoiceChannel: (guildId: string) => Promise<void>;
    speakText: (
        text: string,
        guildId: string,
        voice?: 'alloy' | 'echo' | 'fable' | 'onyx' | 'nova' | 'shimmer'
    ) => Promise<void>;
    getUserVoiceChannel: (member: any) => any;
    isConnectedToVoice: (guildId: string) => boolean;
    getConnectionInfo: (guildId: string) => any;
    destroy: () => void;
}

export interface EngagementService {
    trackMessage: (guildId: string, userId: string, username: string) => void;
    trackCommand: (guildId: string, userId: string, username: string) => void;
    getLeaderboard: (guildId: string, limit?: number) => Promise<Array<{
        userId: string;
        username: string;
        messageCount: number;
        commandCount: number;
        lastActive: Date;
    }>>;
    getUserStats: (guildId: string, userId: string) => Promise<{
        userId: string;
        username: string;
        messageCount: number;
        commandCount: number;
        lastActive: Date;
        firstSeen: Date;
        rank: number;
    } | null>;
    getBufferSize: () => number;
    shutdown: () => Promise<void>;
}

// Re-export types from dedicated type files
export { BotCommand, ExtendedClient, BotEvent, MessageResponse } from '../types/discord';
export { DatabaseTables } from '../types/database';

// Core context interface
export interface Context {
    tables: DatabaseTables;
    log: BotLogger;
    sequelize: Sequelize;
    VERSION: string;
    COMMIT_SHA: string;
    motivationalScheduler?: MotivationalScheduler;
    voiceService?: VoiceService;
    engagementService?: EngagementService;
    client?: any; // Discord client for sending messages
}

// Legacy exports for backward compatibility (will be removed gradually)
export interface Command {
    data: {
        name: string;
    };
    execute: (interaction: unknown, context: Context) => Promise<void>;
    autocomplete?: (interaction: unknown, context: Context) => Promise<void>;
}

export interface Event {
    name: string;
    execute: (...args: unknown[]) => Promise<void>;
    once?: boolean;
}