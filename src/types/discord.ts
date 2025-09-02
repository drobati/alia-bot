/* eslint-disable no-unused-vars */
import {
    SlashCommandBuilder,
    CommandInteraction,
    AutocompleteInteraction,
    Message,
    Client,
    Collection,
} from 'discord.js';
import { Context } from './index';

// Command interface
export interface BotCommand {
    data: SlashCommandBuilder;
    developmentOnly?: boolean; // Flag to mark commands that should only be available in development
    execute(interaction: CommandInteraction, context: Context): Promise<void>;
    autocomplete?(interaction: AutocompleteInteraction, context: Context): Promise<void>;
}

// Extended Discord client interface
export interface ExtendedClient extends Client {
    commands: Collection<string, BotCommand>;
}

// Event handler interface
export interface BotEvent {
    name: string;
    execute(...args: any[]): Promise<void>;
    once?: boolean;
}

// Message response interface for message-based responses
export interface MessageResponse {
    (message: Message, context: Context): Promise<void>;
}

// Autocomplete choice interface
export interface AutocompleteChoice {
    name: string;
    value: string;
}

// Command option types
export interface CommandOptionString {
    name: string;
    description: string;
    required?: boolean;
    autocomplete?: boolean;
}

export interface CommandOptionInteger {
    name: string;
    description: string;
    required?: boolean;
    min_value?: number;
    max_value?: number;
}

export interface CommandOptionNumber {
    name: string;
    description: string;
    required?: boolean;
    min_value?: number;
    max_value?: number;
}

// Subcommand builder type (simplified to avoid unused params)
export interface SubcommandBuilder {
    setName(name: string): SubcommandBuilder;
    setDescription(description: string): SubcommandBuilder;
    addStringOption(option: (builder: unknown) => unknown): SubcommandBuilder;
    addIntegerOption(option: (builder: unknown) => unknown): SubcommandBuilder;
    addNumberOption(option: (builder: unknown) => unknown): SubcommandBuilder;
}