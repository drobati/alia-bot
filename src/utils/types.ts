/* eslint-disable no-unused-vars */
import bunyan from 'bunyan';
import { Client, Collection, Interaction } from 'discord.js';
import db from 'sequelize';

export interface ExtendedClient extends Client {
    commands: Collection<string, Command>;

}

export interface Command {
    data: {
        name: string;
    };
    execute: (interaction: Interaction, context: Context) => Promise<void>;
    autocomplete?: (interaction: Interaction, context: Context) => Promise<void>;
}

export interface Event {
    name: string;
    execute: (...args: any[]) => Promise<void>;
    once?: boolean;
}

export interface tables {
    [key: string]: any;
}
export interface Context {
    tables: tables;
    log: bunyan;
    sequelize: db.Sequelize;
    VERSION: string;
}