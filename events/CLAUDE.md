# Events - CLAUDE.md

## Purpose
This directory contains Discord.js event handlers that respond to various Discord events. These handlers form the core event loop of the bot, processing user interactions, messages, and Discord state changes. Events are automatically loaded and registered during bot initialization.

## Files Overview
- `ready.ts` - Bot initialization and startup procedures when Discord connection is established
- `messageCreate.ts` - Processes all incoming messages for automatic responses (non-slash commands)
- `interactionCreate.ts` - Handles Discord slash command and autocomplete interactions
- `messageReactionAdd.ts.disabled` - Disabled reaction handler (can be enabled for reaction-based features)

## Key Event Handlers

### Ready Event (`ready.ts`)
Executed once when the bot successfully connects to Discord:
- **Startup Logging** - Logs bot initialization with Dune quotes and version info
- **Database Sync** - Synchronizes all Sequelize models with database schema
- **Configuration Debug** - Comprehensive logging of bot configuration and owner settings
- **Channel Verification** - Finds and validates required channels (deploy, general)
- **Deployment Notifications** - Sends startup messages to configured channels
- **Webhook Server** - Starts HTTP server for external webhook integrations
- **Service Initialization** - Sets up background services and schedulers

### Message Creation (`messageCreate.ts`)
Processes every message sent in guilds the bot can see:
- **Response Coordination** - Implements priority-based response system
- **Bot Message Filtering** - Ignores messages from bots to prevent loops
- **Response Priority Order**:
  1. **Assistant** (Highest) - OpenAI-powered responses for questions
  2. **Triggers** - Custom pattern-based responses
  3. **Adlibs** - Template-based text replacement
  4. **Louds** - All-caps message responses (Lowest)
- **Single Response Guarantee** - Only one response type triggers per message
- **Error Handling** - Comprehensive logging for response failures

### Interaction Creation (`interactionCreate.ts`) 
Handles all Discord slash command and autocomplete interactions:
- **Command Routing** - Dispatches interactions to appropriate command handlers
- **Autocomplete Handling** - Manages dynamic option completion for commands
- **Context Creation** - Builds shared Context object for command execution
- **Error Management** - Catches and logs command execution errors
- **Performance Logging** - Tracks command execution times and success rates

## Event Processing Flow

### Message Processing Pipeline
1. **Message Validation** - Check if message should be processed (not from bot, etc.)
2. **Context Building** - Create shared context with database, logger, services
3. **Priority Processing** - Execute response handlers in priority order
4. **Early Termination** - Stop processing after first successful response
5. **Error Logging** - Log any failures for debugging and monitoring

### Interaction Processing Pipeline
1. **Interaction Type Detection** - Determine if command or autocomplete
2. **Command Resolution** - Find matching command handler
3. **Permission Validation** - Check user permissions for restricted commands
4. **Context Injection** - Provide shared context to command
5. **Execution & Response** - Execute command and handle Discord responses
6. **Error Recovery** - Graceful error handling with user feedback

## Error Handling Strategy

### Graceful Degradation
- **Individual Failures** - One failed response doesn't break others
- **Service Isolation** - Database failures don't prevent message processing
- **User Feedback** - Clear error messages for command failures
- **Logging Integration** - All errors sent to Sentry for monitoring

### Recovery Mechanisms
- **Retry Logic** - Automatic retries for transient failures
- **Fallback Responses** - Default responses when services are unavailable
- **Circuit Breakers** - Temporary disabling of failing features
- **Health Monitoring** - Proactive detection of service issues

## Dependencies
### External
- `discord.js` - Event types and client event registration
- `common-tags` - String formatting for log messages and responses

### Internal
- `../src/responses/*` - Message response handlers
- `../src/commands/*` - Slash command implementations
- `../src/utils/types` - Context and BotEvent type definitions
- `../src/utils/discordHelpers` - Discord API helper functions
- `../src/lib/server` - HTTP server for webhook handling

## Configuration Integration

### Channel Management
Events interact with configured channels:
- **Deploy Channel** - Startup and deployment notifications
- **General Channel** - Webhook integrations and announcements
- **Guild-specific Settings** - Response configurations per server

### Feature Toggles
- **Response Priorities** - Configurable response system behavior
- **Debug Logging** - Detailed logging for development environments
- **Service Enablement** - Optional features can be enabled/disabled

## Performance Considerations

### Message Processing Optimization
- **Early Exit Strategy** - Stop processing after first response to reduce CPU usage
- **Database Connection Pooling** - Shared database connections across events
- **Async Processing** - Non-blocking message handling for high throughput
- **Memory Management** - Proper cleanup of temporary resources

### Rate Limiting Protection
- **Discord API Limits** - Respect Discord's rate limiting to prevent bans
- **Response Throttling** - Prevent spam from automated responses
- **Command Cooldowns** - User-specific cooldowns for resource-intensive commands

## Testing & Development

### Event Testing
- **Mock Events** - Simulated Discord events for testing handlers
- **Integration Tests** - End-to-end event processing validation
- **Error Simulation** - Testing error handling and recovery mechanisms
- **Performance Testing** - Measuring response times and throughput

### Development Features
- **Hot Reloading** - Event handlers can be reloaded without restarting (via reload command)
- **Debug Logging** - Detailed logging for troubleshooting event processing
- **Environment Detection** - Different behavior for development vs production