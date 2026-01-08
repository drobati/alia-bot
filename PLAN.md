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
