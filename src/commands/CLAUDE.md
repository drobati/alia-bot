# Commands - CLAUDE.md

## Purpose
This directory contains all Discord slash commands for Alia-bot. Each command is implemented as a separate module that exports a SlashCommandBuilder data object and an execute function. Commands are automatically loaded and registered by the main bot initialization process.

## Files Overview
- `adlibs.ts` - Mad-libs style text replacement command with configurable templates
- `coinbase.ts` - Cryptocurrency price checking and portfolio management 
- `config.ts` - Bot configuration management (add/remove channels, view settings)
- `dadjokes.ts` - Fetches random dad jokes from external API
- `fear.ts` - Random Dune quotes command ("Fear is the mind-killer...")
- `join.ts` - Makes bot join user's voice channel (owner only)
- `leave.ts` - Makes bot leave current voice channel (owner only) 
- `louds.ts` - Manages all-caps message responses (add/remove/list)
- `meme.ts` - Generates memes using canvas with text overlays
- `meme-template.ts` - Defines meme templates with positioning and fonts
- `memories.ts` - Stores and retrieves guild memories (key-value pairs)
- `motivational-config.ts` - Configures motivational quote system
- `poll.ts` - Creates interactive polls with reaction voting
- `qrcode.ts` - Generates QR codes from text input
- `reload.ts` - Hot-reloads bot commands without restart (owner only)
- `rollcall.ts` - Manages member check-ins and attendance tracking
- `sentry-test.ts` - Tests Sentry error reporting integration
- `speak.ts` - Text-to-speech with voice selection and autocomplete
- `tts-config.ts` - Configures TTS settings and voice preferences
- `twitch.ts` - Twitch stream notifications and management

## Key Functions/Classes
- `execute(interaction, context)` - Main command handler function (required)
- `autocomplete(interaction)` - Handles autocomplete for commands with dynamic options
- `checkOwnerPermission()` - Validates owner-only command access
- Command data builders using `SlashCommandBuilder` from discord.js

## Command Categories
### **Utility Commands**
- `config`, `reload`, `sentry-test` - Bot management and testing

### **Entertainment Commands**  
- `dadjokes`, `fear`, `meme`, `poll`, `qrcode` - Fun interactive features

### **Content Management**
- `adlibs`, `louds`, `memories`, `motivational-config` - Configurable responses

### **Voice Features**
- `join`, `leave`, `speak`, `tts-config` - Voice channel interaction

### **External Integration**
- `coinbase`, `twitch` - Third-party service integration

### **Community Features**
- `rollcall` - Member engagement and tracking

## Dependencies
### External
- `discord.js` - Slash command builders and interaction handling
- `canvas` - Image generation for memes
- `openai` - Text-to-speech functionality  
- `axios` - HTTP requests for external APIs
- `qrcode` - QR code generation

### Internal
- `../utils/types` - Context and type definitions
- `../utils/permissions` - Owner permission checking
- `../utils/constants` - Configuration constants
- `../utils/discordHelpers` - Discord API helper functions
- `../models/*` - Database models for persistent storage

## Usage Patterns
Commands are automatically loaded by `loadFiles()` function in main bot file. Each command must export:
```typescript
export default {
    data: SlashCommandBuilder, // Command definition
    execute: async (interaction, context) => {}, // Handler
    autocomplete?: async (interaction) => {} // Optional autocomplete
}
```

Commands receive shared `Context` object containing database models, logger, and services. All commands use ephemeral replies by default for privacy.

## Testing
Each command has corresponding `.test.ts` file with comprehensive Jest test coverage including:
- Command data validation
- Owner permission checking  
- Success and error scenarios
- Database interaction mocking
- Discord API response validation