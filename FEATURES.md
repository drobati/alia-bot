# Alia-Bot Features

A comprehensive Discord bot for the Arrakis Discord guild with 60+ commands, AI-powered responses, and extensive integrations.

---

## Table of Contents
- [Commands](#commands)
  - [Entertainment](#entertainment)
  - [Quotes & Facts](#quotes--facts)
  - [Games](#games)
  - [Utility](#utility)
  - [Voice](#voice)
  - [Content Management](#content-management)
  - [Admin](#admin)
- [Automatic Responses](#automatic-responses)
- [Background Services](#background-services)
- [External Integrations](#external-integrations)
- [Database Models](#database-models)
- [Ideas & Improvements](#ideas--improvements)

---

## Commands

### Entertainment

| Command | Description | Notes |
|---------|-------------|-------|
| `/8ball` | Magic 8-Ball predictions | 20+ responses, color-coded embeds |
| `/affirmation` | Positive affirmations | Target self or others, 25+ templates |
| `/dadjoke` | Random dad jokes | icanhazdadjoke.com API |
| `/joke` | Categorized jokes | General, programming, animals |
| `/roast` | Playful roasts | Light-hearted, self-roast option |
| `/ship` | Relationship compatibility | Hash-based 0-100% score, generates ship name |
| `/fear` | Dune quotes | "Fear is the mind-killer..." |

### Quotes & Facts

| Command | Description | Notes |
|---------|-------------|-------|
| `/quote` | Inspirational quotes | ZenQuotes API |
| `/fact` | Random fun facts | Useless Facts API |
| `/fortune` | Fortune cookie messages | Randomized fortunes |
| `/horoscope` | Zodiac readings | 12 signs, 6 types (daily/love/career/lucky/weekly/monthly) |

### Games

| Command | Description | Notes |
|---------|-------------|-------|
| `/dice` | Advanced dice roller | Supports: `2d6`, `4d6+2`, `d20!` (exploding), `4d6k3` (keep), `2d6r1` (reroll) |
| `/dice custom` | Create custom dice | Named dice with custom sides (e.g., direction: N/S/E/W) |
| `/guess` | Number guessing | Configurable max/attempts |
| `/rps` | Rock-paper-scissors | Classic game vs bot |
| `/trivia` | Trivia quiz | 5 categories, 20 questions, spoiler answers |
| `/riddle` | Riddle challenges | 20+ riddles with hidden answers |
| `/dnd` | D&D game system | Character persistence, game state management |

### Utility

| Command | Description | Notes |
|---------|-------------|-------|
| `/weather` | Weather forecast | Location autocomplete, 5-day forecast, C/F toggle |
| `/stock` | Stock prices | Polygon.io, NASDAQ/NYSE, market status |
| `/coinbase` | Crypto prices | Real-time cryptocurrency data |
| `/qrcode` | QR code generator | Text to QR image |
| `/poll` | Create polls | Reaction voting, duration config (1-1440 min) |
| `/verify` | Member verification | 6-char codes, role-based access, expiration |
| `/rollcall` | Attendance tracking | Member check-in system |

### Voice

| Command | Description | Notes |
|---------|-------------|-------|
| `/speak` | Text-to-speech | OpenAI TTS, 6 voices (Alloy/Echo/Fable/Onyx/Nova/Shimmer) |
| `/join` | Join voice channel | Owner-only |
| `/leave` | Leave voice channel | Owner-only |
| `/tts-config` | TTS settings | Voice preferences per guild |

### Content Management

| Command | Description | Notes |
|---------|-------------|-------|
| `/remember` | Memory storage | Key-value pairs, trigger on mention |
| `/remember trigger` | Auto-respond triggers | Bot responds when key mentioned in chat |
| `/adlibs` | Mad-libs templates | Database-driven, {noun}/{verb} placeholders |
| `/louds` | ALL CAPS responses | Stored uppercase message responses |
| `/meme` | Meme generator | 100+ templates, canvas rendering, usage stats |
| `/meme-template` | Template management | Define positioning, fonts, text boxes |
| `/motivational-config` | Quote scheduler | Cron-based, timezone support |

### Admin

| Command | Description | Notes |
|---------|-------------|-------|
| `/config` | Bot configuration | Welcome messages, verification, limits |
| `/reload` | Hot-reload commands | Owner-only, no restart needed |
| `/sentry-test` | Test error tracking | Owner-only |
| `/stats` | Bot statistics | Usage metrics |
| `/server` | Server info | Guild statistics |
| `/twitch` | Stream notifications | Channel subscriptions, webhooks |

---

## Automatic Responses

Responses process in priority order - only ONE triggers per message:

### 1. Assistant (Highest Priority)
- **Trigger**: Bot mention ("@alia" or "alia,")
- **Tech**: OpenAI GPT + Natural.js Bayesian classifier
- **Features**: Multi-turn conversations, thread persistence, 70% confidence threshold
- **Filters**: Inappropriate/personal requests blocked

### 2. Triggers
- **Trigger**: Message contains configured keyword (case-insensitive)
- **Source**: Memories table (set via `/remember trigger`)
- **Features**: Cached for performance

### 3. Adlibs
- **Trigger**: Message contains `{placeholder}` patterns
- **Source**: Adlibs table
- **Features**: Template replacement with random words

### 4. Louds
- **Trigger**: Message is >80% uppercase
- **Source**: Louds table
- **Features**: Responds with stored ALL CAPS messages

### 5. Tips
- **Trigger**: Contextual based on command usage
- **Features**: Helpful hints about bot features

---

## Background Services

### VoiceService
- Voice channel connection management
- OpenAI TTS integration
- Auto-cleanup on disconnect
- 20-second timeout per message
- Temporary MP3 file handling

### MotivationalScheduler
- Cron-based quote posting
- Guild-specific scheduling
- Timezone-aware
- Rate limited (max 4/day per channel)

### EngagementService
- User message/command tracking
- Buffered writes (flushes every 60s)
- Leaderboard and profile data

---

## External Integrations

| Service | Purpose | Auth Required |
|---------|---------|---------------|
| **OpenAI** | AI responses, TTS | Yes (`OPENAI_API_KEY`) |
| **Polygon.io** | Stock prices | Yes (`POLYGON_API_KEY`) |
| **Open-Meteo** | Weather | No |
| **ZenQuotes** | Inspirational quotes | No |
| **Useless Facts** | Random facts | No |
| **icanhazdadjoke** | Dad jokes | No |
| **Twitch** | Stream notifications | Yes (OAuth) |
| **Sentry** | Error tracking | Yes (`SENTRY_DSN`) |

---

## Database Models

### Content
- `Memories` - Key-value storage with trigger flag
- `Adlibs` - Mad-libs templates
- `Louds` - ALL CAPS responses
- `MemeTemplate` - Meme definitions with positioning

### Configuration
- `Config` - Bot-wide settings, OpenAI threads
- `MotivationalConfig` - Quote scheduler settings
- `Twitch` - Stream notification config

### Interactive Features
- `Poll` / `PollVote` - Polls and votes
- `DndGame` - D&D game state
- `CustomDice` - Guild custom dice
- `VerificationCode` - Member verification
- `HoroscopeUser` / `HoroscopeCache` - Horoscope preferences/cache

### Engagement
- `UserStats` - Message/command counts, rankings
- `RollCall` - Attendance tracking

---

## Ideas & Improvements

### Missing Commands (from GitHub issues)
- [ ] `/help` - Command listing with categories
- [ ] `/avatar` - Display user avatars
- [ ] `/calc` - Calculator
- [ ] `/color` - Color info/conversion
- [ ] `/remind` - Reminders
- [ ] `/translate` - Text translation
- [ ] `/activity` - Bored API suggestions
- [ ] `/crypto` - CoinGecko integration
- [ ] `/github` - GitHub user/repo info
- [ ] `/youtube` - YouTube video search
- [ ] `/reddit` - Reddit posts
- [ ] `/url` - URL shortener

### Feature Improvements
- [ ] Add autocomplete to more commands
- [ ] Leaderboard pagination
- [ ] Profile badges/achievements
- [ ] Scheduled reminders
- [ ] Custom embed colors per guild
- [ ] Command usage analytics dashboard
- [ ] Bulk memory import/export

### Technical Debt
- [ ] Consolidate similar API patterns
- [ ] Add rate limiting to external APIs
- [ ] Improve error messages for users
- [ ] Add command cooldowns
- [ ] Database query optimization

### New Integrations
- [ ] Spotify (now playing)
- [ ] Steam (game status)
- [ ] IMDb/TMDb (movie info)
- [ ] Urban Dictionary
- [ ] Giphy

---

## Statistics

- **Commands**: 60+
- **Response Types**: 5
- **Database Models**: 15
- **External APIs**: 8
- **Dice Modifiers**: 7
- **Meme Templates**: 100+
- **Weather Codes**: 40+
