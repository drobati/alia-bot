# Dota 2 Discord Leaderboard Feature

## Overview
Build a Discord command system that integrates with the OpenDota API to track and display Dota 2 performance leaderboards for registered Discord users.

## Features

### 1. `/dota register <steam_id>` - Register Steam Account
- Link Discord user to their Steam ID (32-bit format)
- Validate Steam ID exists via OpenDota API
- Store mapping in database
- Allow users to update their registration

### 2. `/dota unregister` - Remove Registration
- Allow users to unlink their Steam account

### 3. `/dota profile [user]` - View Player Profile
- Show individual player stats
- Optional: view another registered user's profile

### 4. `/dota leaderboard [timeframe]` - View Guild Leaderboard
- Display top players in the Discord guild
- Timeframes: `week`, `month`, `all` (default: month)
- Metrics: Win rate, total wins, MMR estimate

## Technical Design

### Database Model: `dota_users`
| Column | Type | Description |
|--------|------|-------------|
| id | INTEGER | Primary key |
| discord_id | STRING | Discord user ID |
| guild_id | STRING | Discord guild ID (for guild-scoped leaderboards) |
| steam_id | STRING | Steam 32-bit account ID |
| steam_username | STRING | Cached Steam persona name |
| created_at | DATE | Registration timestamp |
| updated_at | DATE | Last update timestamp |

**Indexes:**
- Unique: `(discord_id, guild_id)` - One registration per user per guild
- Index: `guild_id` - For leaderboard queries

### OpenDota API Endpoints
- `GET /api/players/{account_id}` - Player profile & MMR
- `GET /api/players/{account_id}/wl` - Win/loss counts (supports date filtering)
- `GET /api/players/{account_id}/recentMatches` - Recent match history

### API Rate Limiting
- OpenDota free tier: 60 requests/minute
- Implement simple in-memory caching (5 min TTL)
- Batch leaderboard requests with delays

## File Structure
```
src/
├── commands/
│   └── dota.ts              # Slash command with subcommands
├── models/
│   └── dotaUsers.ts         # Database model
├── lib/
│   └── apis/
│       └── opendota.ts      # OpenDota API client
└── types/
    └── opendota.ts          # API response types
```

## Implementation Tasks
1. Create database model and migration
2. Create OpenDota API client
3. Implement `/dota register` command
4. Implement `/dota unregister` command
5. Implement `/dota profile` command
6. Implement `/dota leaderboard` command
7. Add tests
8. Update documentation

## Leaderboard Ranking Logic
Players ranked by **win rate** with minimum 10 games in timeframe:
1. Fetch all registered users for guild
2. Get win/loss for each player within timeframe
3. Filter out players with < 10 games
4. Sort by win rate descending
5. Display top 10 with wins/losses/rate

---

# ARC Raiders Event Timer Feature Plan

## Overview
Add event timer tracking and announcement system to the `/arc` command. This will allow users to subscribe to in-game events (like Harvesters, Night Raid, Matriarch) and receive customizable notifications before events occur.

## Data Source
MetaForge API provides event data at `https://metaforge.app/api/arc-raiders/events`:
- Returns JSON with event schedules
- Events have: name, map, icon URL, startTime, endTime (Unix timestamps in ms)
- Events rotate hourly

### Available Events (11 types)
1. Harvester
2. Husk Graveyard
3. Night Raid
4. Electromagnetic Storm
5. Prospecting Probes
6. Matriarch
7. Locked Gate
8. Launch Tower Loot
9. Hidden Bunker
10. Lush Blooms
11. Uncovered Caches

### Available Maps (5)
1. Spaceport
2. Blue Gate
3. Buried City
4. Dam
5. Stella Montis

## Feature Requirements

### 1. Event Subscriptions
Users can subscribe to events with customizable settings:
- **Event filter**: Specific events (e.g., "Harvester only") or all events
- **Map filter**: Specific maps (e.g., "Blue Gate only") or all maps
- **Warning times**: How far in advance to notify (e.g., 15m, 30m, 1h before)
- **Delivery method**: Channel announcement, DM, or both

### 2. Announcement Configuration (Server-level)
Guild admins can configure:
- Default announcement channel for the server
- Whether to allow channel announcements
- Whether to allow DMs

### 3. Subscription Management
- `/arc events subscribe` - Subscribe to events with filters
- `/arc events unsubscribe` - Remove subscription
- `/arc events list` - List your subscriptions
- `/arc events upcoming` - Show upcoming events (no subscription needed)
- `/arc events config` - (Admin) Configure server settings

## Technical Implementation

### Database Model: ArcEventSubscription

```typescript
{
  id: INTEGER (auto-increment PK),
  guild_id: STRING (required, indexed),
  user_id: STRING (required, indexed),

  // Filters
  event_types: TEXT (JSON array - null = all events),
  maps: TEXT (JSON array - null = all maps),

  // Notification settings
  warn_minutes: TEXT (JSON array, e.g., [15, 30, 60]),
  notify_dm: BOOLEAN (default false),
  notify_channel: BOOLEAN (default true),

  // Status
  active: BOOLEAN (default true),

  created_at: DATE,
  updated_at: DATE
}

// Unique constraint: (guild_id, user_id)
```

### Database Model: ArcEventConfig (Guild settings)

```typescript
{
  id: INTEGER (auto-increment PK),
  guild_id: STRING (required, unique),

  // Announcement channel
  announcement_channel_id: STRING (nullable),

  // Permissions
  allow_channel_announcements: BOOLEAN (default true),
  allow_dm_notifications: BOOLEAN (default true),

  created_at: DATE,
  updated_at: DATE
}
```

### MetaForge API Extension

Add to `src/lib/apis/metaforge.ts`:

```typescript
interface ArcEvent {
  name: string;
  map: string;
  icon: string;
  startTime: number; // Unix timestamp ms
  endTime: number;   // Unix timestamp ms
}

interface ArcEventsResponse {
  data: ArcEvent[];
  cachedAt: number;
}

const getEvents = async (): Promise<ArcEvent[]>;
const getUpcomingEvents = async (minutes: number): Promise<ArcEvent[]>;
```

### Event Handler: ArcEventHandler

New handler in `src/services/eventHandlers/arcEventHandler.ts`:
- Type: 'arcEvent'
- Validates subscription payload
- Sends formatted event announcements
- Supports both channel and DM delivery
- Uses embed with event icon, map, timing

### Scheduler Integration

The event timer system will use a cron job to:
1. Poll MetaForge API every 5 minutes
2. Check for events starting within warning windows
3. Find matching subscriptions
4. Create one-time scheduled events for each notification
5. Execute announcements at warning times

Cron schedule: `*/5 * * * *` (every 5 minutes)

### New Subcommand Group Structure

The `/arc` command will use a subcommand group for events:

```
/arc events subscribe
/arc events unsubscribe
/arc events list
/arc events upcoming
/arc events config
```

#### `/arc events subscribe`
Options:
- `event` (STRING, optional, autocomplete): Filter to specific event type
- `map` (STRING, optional, autocomplete): Filter to specific map
- `warn_at` (STRING, required): Comma-separated minutes (e.g., "15,30,60")
- `dm` (BOOLEAN, optional): Send DM notifications
- `channel` (BOOLEAN, optional): Send channel notifications (default true)

#### `/arc events unsubscribe`
Options:
- `subscription_id` (STRING, required, autocomplete): Your subscription to remove

#### `/arc events list`
Shows all your active subscriptions with filters and settings.

#### `/arc events upcoming`
Options:
- `hours` (INTEGER, optional): Hours ahead to show (default 2, max 24)
- `map` (STRING, optional, autocomplete): Filter to specific map
- `event` (STRING, optional, autocomplete): Filter to specific event

#### `/arc events config` (Admin only)
Options:
- `channel` (CHANNEL, optional): Set announcement channel
- `allow_channel` (BOOLEAN, optional): Allow channel announcements
- `allow_dm` (BOOLEAN, optional): Allow DM notifications

## Embed Design

### Event Notification Embed
```
[Event Icon] Harvester - Blue Gate

Starting in 15 minutes!

Map: Blue Gate
Event: Harvester
Starts: <t:1234567890:R>
Ends: <t:1234567890:t>

[Footer: ARC Raiders Event Timer | Data from metaforge.app]
```

### Upcoming Events Embed
```
Upcoming Events (Next 2 Hours)

Blue Gate
- Harvester - <t:1234567890:R>
- Night Raid - <t:1234567891:R>

Dam
- Matriarch - <t:1234567892:R>

[Footer: Use /arc events subscribe to get notifications]
```

## Implementation Order

1. **Database migrations** - Create subscription and config tables
2. **MetaForge API** - Add event fetching functions
3. **Database models** - ArcEventSubscription, ArcEventConfig
4. **Event handler** - ArcEventHandler for notifications
5. **Event polling service** - Cron job to check upcoming events
6. **Subcommands** - Add all event-related subcommands
7. **Testing** - Unit tests for new functionality
8. **Documentation** - Update COMMANDS.md

## Edge Cases

- API unavailable: Log error, skip cycle, retry next poll
- No announcement channel set: Only send DMs to subscribers with DM enabled
- User has DMs disabled: Log warning, skip that notification
- Duplicate notifications: Track sent notifications to avoid spam
- Subscription cleanup: Remove subscriptions when user leaves guild

## Future Enhancements

- Role mentions for specific events
- Custom notification messages
- Event history tracking
- Favorite maps/events quick-subscribe
- Integration with wishlist (notify when event has items you need)
