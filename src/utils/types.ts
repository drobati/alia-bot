/* eslint-disable no-unused-vars */
import bunyan from 'bunyan';
import { Sequelize } from 'sequelize';
import { DatabaseTables } from '../types/database';

// Re-export types from dedicated type files
export { BotCommand, ExtendedClient, BotEvent, MessageResponse } from '../types/discord';
export { DatabaseTables } from '../types/database';

// Core context interface
export interface Context {
    tables: DatabaseTables;
    log: bunyan.Logger;
    sequelize: Sequelize;
    VERSION: string;
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