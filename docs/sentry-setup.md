# Sentry.io Logging Setup

This document explains how to set up Sentry.io logging for the Alia-bot Discord bot.

## What is Sentry?

Sentry.io is a cloud-based error tracking and performance monitoring service that helps developers identify and fix issues in production applications. It's free for small projects and provides excellent debugging capabilities.

## Benefits for Alia-bot

- **Real-time Error Tracking**: Automatically capture and report errors with full stack traces
- **Owner ID Debugging**: Specifically track owner permission issues we've been having
- **Performance Monitoring**: Optional performance profiling to identify bottlenecks
- **Contextual Information**: Rich context about each error including user info, environment, etc.
- **Free Tier**: Up to 5,000 errors/month and 10,000 performance units/month at no cost

## Setup Instructions

### 1. Create Sentry Project

1. Go to [sentry.io](https://sentry.io) and create a free account
2. Create a new project
   - Choose "Node.js" as the platform
   - Name it "alia-bot" or similar
3. Copy the DSN (Data Source Name) from the project settings

### 2. Environment Configuration

Add the Sentry DSN to your environment variables:

**For Development (.env file):**
```bash
SENTRY_DSN=https://your-dsn-here@sentry.io/project-id
```

**For Production (AWS Systems Manager Parameter Store):**
```bash
# Add via AWS CLI or Console
aws ssm put-parameter \
  --name "/alia-bot/SENTRY_DSN" \
  --value "https://your-dsn-here@sentry.io/project-id" \
  --type "SecureString" \
  --region us-east-1
```

### 3. Code Integration

The Sentry integration is already implemented in the codebase:

- **Initialization**: `src/lib/sentry.ts` handles Sentry setup
- **Error Capture**: Automatic error capture throughout the application  
- **Owner ID Debugging**: Special tracking for owner permission issues
- **User Context**: Sets Discord user information for each interaction

### 4. Key Features Implemented

#### Owner ID Debugging
Every permission check now sends debugging data to Sentry:
```typescript
captureOwnerIdDebug({
    command: '/join',
    userId: '145679133257498624', 
    username: 'username',
    configuredOwnerId: '145679133257498620', // Wrong ID will be captured
    isOwner: false,
    event: 'permission_check'
});
```

#### Error Tracking
All errors are automatically sent to Sentry with context:
- Discord command that failed
- User information
- Bot configuration
- Environment details

#### Performance Monitoring (Optional)
- 10% sample rate for performance tracking
- Profiling integration for identifying bottlenecks

## Usage

### Viewing Errors
1. Log into your Sentry dashboard
2. Navigate to your alia-bot project
3. View real-time errors and performance data

### Owner ID Debugging
When the owner ID mismatch issue occurs:
1. The error will appear in Sentry with full context
2. Breadcrumbs will show the exact permission check flow
3. User context will show the Discord user attempting the command
4. You can see exactly what owner ID was configured vs. what was expected

### Search and Filtering
- Filter by error type, user, or time period
- Search for specific commands or users
- Set up alerts for critical errors

## Cost Considerations

Sentry.io free tier includes:
- 5,000 errors per month
- 10,000 performance transactions per month
- 30-day data retention

This should be more than sufficient for Alia-bot's usage patterns.

## Security Notes

- Sentry DSN is not sensitive (it's meant to be included in client-side code)
- No sensitive user data is sent to Sentry
- Error messages are sanitized automatically

## Testing the Integration

To verify Sentry is working:

1. Trigger an owner permission error (try `/join` with wrong owner ID)
2. Check Sentry dashboard for the error
3. Look for breadcrumbs showing the permission check flow

## Next Steps

After deploying with Sentry enabled, you should be able to:
1. See exactly what owner ID is being configured at startup
2. Track any permission check failures with full context
3. Identify the source of the owner ID mismatch issue
4. Monitor overall bot health and performance