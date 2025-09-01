# Services - CLAUDE.md

## Purpose
This directory contains service classes that provide business logic and complex functionality for the bot. Services handle stateful operations, external integrations, and background processes that extend beyond simple command execution or message responses.

## Files Overview
- `voice.ts` - Discord voice channel management with TTS capabilities
- `motivationalScheduler.ts` - Background scheduling service for automated motivational quotes

## Key Classes/Functions

### VoiceService Class
Main voice channel management service providing:
- `joinVoiceChannel(channel)` - Connects bot to Discord voice channels
- `leaveVoiceChannel(guildId)` - Disconnects from voice channels
- `speakText(text, guildId, voice)` - Text-to-speech using OpenAI API
- `getUserVoiceChannel(member)` - Finds user's current voice channel
- `isConnectedToVoice(guildId)` - Checks bot voice connection status
- `getConnectionInfo(guildId)` - Returns voice connection details
- `destroy()` - Cleanup all connections on shutdown

### MotivationalScheduler Class
Background service for automated content:
- Scheduled motivational quote posting
- Guild-specific configuration support
- Timezone-aware scheduling
- Database integration for quote storage

## Service Features

### Voice Channel Management
- **Connection Pooling** - Manages multiple guild voice connections simultaneously
- **Auto-cleanup** - Handles disconnection events and resource cleanup
- **Error Recovery** - Reconnection logic for dropped connections
- **State Tracking** - Maintains connection status per guild

### Text-to-Speech Integration
- **OpenAI Integration** - Uses OpenAI TTS API for voice generation
- **Voice Selection** - Supports multiple voice options (alloy, echo, fable, onyx, nova, shimmer)
- **Audio Processing** - Handles MP3 generation and temporary file management
- **Playback Control** - Manages audio playback with timeout handling

### Background Scheduling
- **Cron-based Scheduling** - Uses node-cron for precise timing control
- **Database-driven Configuration** - Guild settings control scheduling behavior
- **Content Rotation** - Manages quote databases and prevents repetition
- **Graceful Shutdown** - Properly handles service termination

## Dependencies
### External
- `@discordjs/voice` - Discord voice connection management and audio playback
- `@snazzah/davey` - DAVE protocol support for Discord voice connections
- `openai` - Text-to-speech API integration
- `node-cron` - Background job scheduling
- `fs` - File system operations for temporary audio files

### Internal
- `../utils/types` - Context and type definitions
- `../utils/constants` - Configuration constants (TTS_CONFIG)
- `../models/*` - Database models for configuration storage
- `../utils/motivationalGenerator` - Content generation utilities

## Usage Patterns

### Service Initialization
Services are instantiated during bot startup and passed through Context:
```typescript
const voiceService = new VoiceService(context);
context.voiceService = voiceService;
```

### Command Integration
Commands access services through the Context object:
```typescript
async execute(interaction, context) {
    const { voiceService } = context;
    await voiceService.joinVoiceChannel(channel);
}
```

### Background Processing
Services can run independent of user interactions:
```typescript
// Motivational scheduler runs on timer
scheduler.start(); // Begins background quote posting
```

## Error Handling
Services implement comprehensive error handling:
- **Connection Failures** - Voice connection retry logic and fallbacks
- **API Failures** - OpenAI API error handling and rate limiting
- **Resource Management** - Proper cleanup of temporary files and connections
- **Graceful Degradation** - Service continues operating with reduced functionality

## Performance Considerations
- **Resource Pooling** - Voice connections are reused across requests
- **Memory Management** - Temporary audio files are cleaned up automatically
- **Connection Limits** - Respects Discord API rate limits and connection caps
- **Async Processing** - Non-blocking operations for better responsiveness

## Testing
Service testing includes:
- **Integration Tests** - Real Discord voice connection testing
- **Mock Testing** - External API simulation (OpenAI, Discord)
- **Resource Testing** - Memory leak and cleanup validation
- **Error Simulation** - Network failure and recovery testing