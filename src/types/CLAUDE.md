# Types - CLAUDE.md

## Purpose
This directory contains TypeScript type definitions that provide type safety and structure for database models, Discord integrations, and other complex data structures used throughout the bot. These types ensure consistency and catch errors at compile time.

## Files Overview
- `index.ts` - Central export file that re-exports all types for easy importing
- `database.ts` - Database model interfaces and type definitions for Sequelize models
- `discord.ts` - Discord.js extensions and custom Discord-related type definitions

## Key Type Categories

### Database Types (`database.ts`)
Comprehensive interfaces for all database models:

#### Content Management Types
- `AdlibsAttributes` - Mad-libs template structure with placeholders and metadata
- `LoudsAttributes` - All-caps message responses with triggers and responses
- `MemoriesAttributes` - Guild-specific key-value storage with timestamps
- `MemeTemplateAttributes` - Meme template definitions with positioning data

#### Configuration Types
- `ConfigAttributes` - Bot configuration key-value pairs and OpenAI thread storage
- `MotivationalConfigAttributes` - Motivational quote system settings per guild
- `TwitchAttributes` - Twitch stream notification configurations

#### Interactive Feature Types
- `PollAttributes` - Poll definitions with questions, options, and expiration
- `PollVoteAttributes` - Individual vote records with user and option data
- `RollCallAttributes` - Member attendance tracking with check-in timestamps

#### Model Interface Extensions
- `CreationAttributes<T>` - Types for model creation (excludes auto-generated fields)
- `UpdateAttributes<T>` - Types for model updates (optional fields)
- `ModelInstance<T>` - Full model instances with Sequelize methods

### Discord Extensions (`discord.ts`)
Custom Discord.js type extensions and enhancements:

#### Command Extensions
- `SlashCommandData` - Extended slash command definitions with autocomplete
- `CommandExecutor` - Standardized command execution function signature
- `AutocompleteHandler` - Type-safe autocomplete function definitions

#### Context Extensions
- `GuildContext` - Guild-specific context data and permissions
- `UserContext` - User-specific data and interaction history
- `ChannelContext` - Channel-specific settings and configurations

#### Event Extensions
- `BotEvent` - Standardized event handler interface
- `EventExecutor` - Type-safe event execution function signature

## Type Safety Benefits

### Compile-time Validation
- **Required Fields** - Ensures all required model fields are provided
- **Type Checking** - Prevents runtime errors from incorrect data types
- **Auto-completion** - IDE support with IntelliSense for all properties
- **Interface Compliance** - Guarantees objects match expected structure

### Database Safety
- **Model Consistency** - Ensures database operations use correct field types
- **Query Safety** - Prevents invalid queries through type constraints
- **Relationship Integrity** - Types enforce proper foreign key relationships
- **Migration Safety** - Types must be updated when database schema changes

## Usage Patterns

### Model Creation
```typescript
import { AdlibsCreationAttributes } from '../types/database';

const newAdlib: AdlibsCreationAttributes = {
    template: "Hello {name}, welcome to {place}!",
    placeholders: ["name", "place"],
    guildId: guild.id,
    createdBy: user.id
};
```

### Command Definitions
```typescript
import { SlashCommandData, CommandExecutor } from '../types/discord';

const commandData: SlashCommandData = {
    name: 'example',
    description: 'Example command',
    execute: commandExecutor
};
```

### Type Guards
```typescript
function isTextChannel(channel: any): channel is TextChannel {
    return channel?.type === ChannelType.GuildText;
}
```

## Dependencies
### External
- `sequelize` - Extends Sequelize model types with custom attributes
- `discord.js` - Extends Discord.js types with bot-specific enhancements

### Internal
- Imported throughout the application for type safety
- `src/utils/types.ts` - Contains the main Context interface and BotEvent types
- All models, commands, responses, and services use these types

## Type Definition Standards

### Naming Conventions
- `<Model>Attributes` - Full model interface with all fields
- `<Model>CreationAttributes` - Fields required for model creation
- `<Model>UpdateAttributes` - Optional fields for model updates

### Optional vs Required
- **Database IDs** - Auto-generated fields are optional in creation types
- **Timestamps** - `createdAt`/`updatedAt` are optional (Sequelize handles them)
- **Foreign Keys** - Required fields that establish relationships
- **User Data** - Fields requiring user input are marked as required

### Generic Types
- `ModelInstance<T>` - Generic wrapper for Sequelize model instances
- `CommandHandler<T>` - Generic command execution with specific interaction types
- `EventHandler<T>` - Generic event handlers with specific event types

## Maintenance & Updates

### Schema Changes
When database schema changes:
1. Update model attribute interfaces
2. Adjust creation/update types accordingly
3. Update any affected command or response handlers
4. Run type checking to catch breaking changes

### Discord.js Updates
When Discord.js is updated:
1. Review breaking changes in Discord types
2. Update extension interfaces if needed
3. Test command and event type compatibility
4. Update interaction handling types as needed

## Testing & Validation
Type definitions are validated through:
- **Compilation** - TypeScript compiler ensures type consistency
- **Unit Tests** - Tests validate that objects match type definitions
- **Integration Tests** - Database operations confirm type accuracy
- **IDE Integration** - Development-time validation and error highlighting