# Lib - CLAUDE.md

## Purpose
This directory contains core library modules that provide foundational functionality for the bot infrastructure. These are low-level components that handle critical system operations like error tracking, monitoring, and external service integrations.

## Files Overview
- `sentry.ts` - Error tracking and performance monitoring integration with Sentry.io
- `server.ts` - HTTP server for webhook handling and external service integrations

## Key Functions/Classes

### Sentry Integration (`sentry.ts`)
- `initializeSentry(environment)` - Initializes Sentry SDK with comprehensive configuration
- `validateSentryDSN(dsn)` - Validates Sentry DSN format and extracts components
- `testSentryConnectivity()` - Tests connectivity to Sentry servers
- `Sentry` object export - Pre-configured Sentry instance for error reporting

#### Sentry Features
- **Error Tracking** - Automatic exception capture and stack trace collection
- **Performance Monitoring** - Transaction tracing and performance metrics
- **User Context** - Discord user and guild information attachment
- **Environment Detection** - Separate environments for development/production
- **DSN Validation** - Supports both US (.us.sentry.io) and EU (.sentry.io) regions
- **Connectivity Testing** - Startup validation ensures Sentry is reachable

### HTTP Server (`server.ts`)
- Webhook endpoint handling for external service integrations
- Twitch stream notification processing
- Discord embed generation for webhook events
- Health check endpoints for monitoring

## Configuration & Environment

### Sentry Configuration
- **DSN Format** - Supports multiple Sentry regions with validation
- **Environment Variables** - `SENTRY_DSN`, `NODE_ENV` for configuration
- **Sampling Rates** - Configurable transaction and error sampling
- **Integration Options** - Express, HTTP, and performance integrations

### Server Configuration  
- **Port Configuration** - Uses config system for webhook port settings
- **CORS Handling** - Cross-origin request support for webhooks
- **Error Middleware** - Proper error handling for webhook endpoints

## Error Handling Strategy

### Comprehensive Error Capture
- **Unhandled Exceptions** - Global error handlers for uncaught errors
- **Async Errors** - Promise rejection handling
- **Discord API Errors** - Specific handling for Discord.js errors
- **Database Errors** - Sequelize error categorization

### Contextual Information
- **User Context** - Discord user ID, username, and guild information
- **Command Context** - Active command and interaction details
- **Environment Context** - Node.js version, bot version, deployment info
- **Custom Tags** - Feature-specific tags for error categorization

## Dependencies
### External
- `@sentry/node` - Node.js Sentry SDK for error tracking
- `@sentry/profiling-node` - Performance profiling capabilities
- `@hapi/hapi` - HTTP server framework for webhook handling
- `axios` - HTTP client for external API calls

### Internal
- Integrated throughout the application via Context object
- Logger integration for structured error reporting
- Used by all commands, responses, and services for error tracking

## Usage Patterns

### Error Reporting
```typescript
import { Sentry } from '../lib/sentry';

// Automatic error capture
Sentry.captureException(error);

// Custom context
Sentry.setUser({ id: userId, username });
Sentry.setTags({ command: 'speak', guild: guildId });
```

### Performance Monitoring
```typescript
const transaction = Sentry.startTransaction({
    name: 'Command Execution',
    op: 'discord.command'
});
// ... command logic
transaction.finish();
```

## Production Considerations

### Privacy & Data Protection
- **Data Scrubbing** - Sensitive information filtering before sending to Sentry
- **Rate Limiting** - Prevents spam from repeated errors
- **Sampling** - Reduces data volume while maintaining visibility

### Performance Impact
- **Async Processing** - Error reporting doesn't block main thread
- **Minimal Overhead** - Optimized for production performance
- **Graceful Degradation** - Bot continues operating if Sentry unavailable

## Testing
Library testing includes:
- **DSN Validation** - Various DSN format testing
- **Connectivity Tests** - Sentry API reachability validation
- **Mock Testing** - Simulated error conditions and webhook events
- **Integration Tests** - End-to-end error reporting validation