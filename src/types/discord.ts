import { 
    SlashCommandBuilder, 
    CommandInteraction, 
    AutocompleteInteraction,
    Message,
    Client,
    Collection
} from 'discord.js';
import { Context } from './index';

// Command interface
export interface BotCommand {
    data: SlashCommandBuilder;
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
    execute(...args: unknown[]): Promise<void>;
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

// Subcommand builder type
export interface SubcommandBuilder {
    setName(name: string): SubcommandBuilder;
    setDescription(description: string): SubcommandBuilder;
    addStringOption(option: (builder: any) => any): SubcommandBuilder;
    addIntegerOption(option: (builder: any) => any): SubcommandBuilder;
    addNumberOption(option: (builder: any) => any): SubcommandBuilder;
}