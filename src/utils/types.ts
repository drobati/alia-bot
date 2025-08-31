/* eslint-disable no-unused-vars */
import bunyan from 'bunyan';
import { Sequelize } from 'sequelize';
import { DatabaseTables } from '../types/database';

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

// Re-export types from dedicated type files
export { BotCommand, ExtendedClient, BotEvent, MessageResponse } from '../types/discord';
export { DatabaseTables } from '../types/database';

// Core context interface
export interface Context {
    tables: DatabaseTables;
    log: bunyan;
    sequelize: Sequelize;
    VERSION: string;
    motivationalScheduler?: MotivationalScheduler;
    voiceService?: VoiceService;
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