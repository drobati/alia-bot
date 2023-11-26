/* eslint-disable no-unused-vars */
import bunyan from 'bunyan';
import { Client, ClientEvents, Collection, Events, Interaction, Message } from 'discord.js';
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

export type EventHandlers = {
    [K in keyof ClientEvents]: (...args: [...ClientEvents[K], Context]) => Promise<void>;
}

export interface Event<K extends keyof ClientEvents> {
    name: K;
    execute: EventHandlers[K];
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