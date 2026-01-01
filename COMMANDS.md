# Alia-bot Commands Reference

> Complete guide to all available Discord slash commands

## Table of Contents
- [Content Management](#content-management)
- [Entertainment](#entertainment)
- [Interactive Commands](#interactive-commands)  
- [Utility Commands](#utility-commands)
- [Administrative Commands](#administrative-commands)
- [Voice Commands](#voice-commands)
- [Owner-Only Commands](#owner-only-commands)

---

## Content Management

### `/adlibs`
**Purpose:** Manage ad-libs for mad-libs style text replacement in messages

**Usage:**
```
/adlibs add adlib:"suddenly"
/adlibs remove adlib:"suddenly"
```

**Subcommands:**
- `add` - Add a new ad-lib word/phrase
  - `adlib` (required) - The text to add to the ad-libs collection
- `remove` - Remove an existing ad-lib
  - `adlib` (required, autocomplete) - Select from existing ad-libs

**Features:**
- Autocomplete suggestions when removing
- Used by automatic message responses for text replacement

---

### `/louds`
**Purpose:** Manage loud messages (all-caps responses) that the bot can use

**Usage:**
```
/louds count
/louds list limit:20
/louds ban text:"INAPPROPRIATE LOUD"
/louds delete text:"OLD LOUD MESSAGE"
```

**Subcommands:**
- `count` - Show total number of loud messages
- `list` - Display recent loud messages
  - `limit` (optional) - Number to show (1-50, default: 10)
- `delete` - Remove a loud message permanently
  - `text` (required, autocomplete) - Select message to delete
- `ban` - Forbid a specific loud message from being used
  - `text` (required, autocomplete) - Select message to ban
- `unban` - Allow a previously banned message
  - `text` (required, autocomplete) - Select message to unban

**Features:**
- Autocomplete for all text selections
- Separate ban/delete functionality for content moderation

---

### `/remember`
**Purpose:** Bot's memory system for storing and retrieving key-value pairs

**Usage:**
```
/remember add key:"favorite_color" value:"blue"
/remember get key:"favorite_color"
/remember trigger key:"greeting"
/remember top amount:5
```

**Subcommands:**
- `get` - Retrieve a stored value
  - `key` (required) - The memory key to look up
- `add` - Store a new key-value pair
  - `key` (required) - Memory key name
  - `value` (required) - Value to remember
- `delete` - Remove a memory
  - `key` (required) - Key to delete
- `top` - Show most frequently accessed memories
  - `amount` (optional) - Number of results
- `random` - Get random memories
  - `amount` (optional) - Number of random entries
- `trigger` - Enable automatic responses for a key
  - `key` (required) - Key to trigger on
- `untrigger` - Disable automatic responses
  - `key` (required) - Key to stop triggering

**Features:**
- Triggered memories respond automatically when mentioned in messages
- Access count tracking for popular memories

---

## Entertainment

### `/dadjoke`
**Purpose:** Get random dad jokes for entertainment

**Usage:**
```
/dadjoke
```

**Features:**
- Fetches jokes from icanhazdadjoke.com API
- No options required - just instant dad joke delivery

---

### `/fear`
**Purpose:** Display the Litany Against Fear from Dune

**Usage:**
```
/fear
```

**Features:**
- Shows the complete litany text
- Response is ephemeral (only visible to you)
- Perfect for moments when you need courage

---

### `/trivia`
**Purpose:** Test your knowledge with random trivia questions

**Usage:**
```
/trivia
```

**Features:**
- Presents a random multiple-choice question with 4 options (A, B, C, D)
- Answer hidden in a spoiler tag - click to reveal
- Options are shuffled each time to prevent memorization
- Category-specific emoji in the title

**Categories:**
- 🔬 Science - Chemistry, biology, astronomy
- 📜 History - World events, famous figures
- 🌍 Geography - Countries, capitals, natural features
- 🎬 Entertainment - Movies, music, video games
- 💻 Technology - Computing, internet, tech history

---

### `/qr`
**Purpose:** Generate QR codes for URLs

**Usage:**
```
/qr url:"https://example.com"
/qr url:"example.com"
```

**Parameters:**
- `url` (required) - The URL to encode in the QR code

**Features:**
- Automatically adds https:// if protocol is missing
- Validates URL format before generating
- Returns image file that can be scanned

---

### `/meme`
**Purpose:** Create memes with customizable text overlays

**Usage:**
```
/meme create template:"drake" top:"Old way" bottom:"New way"
/meme custom url:"https://i.imgur.com/example.jpg" top:"Top text"
/meme list page:2
```

**Subcommands:**
- `create` - Use predefined meme templates
  - `template` (required, autocomplete) - Select from available templates
  - `top` (optional) - Top text overlay
  - `bottom` (optional) - Bottom text overlay
- `custom` - Use your own image URL
  - `url` (required) - Direct link to image
  - `top` (optional) - Top text overlay
  - `bottom` (optional) - Bottom text overlay
- `list` - Browse available templates
  - `page` (optional) - Page number (10 templates per page)

**Features:**
- Template autocomplete with fuzzy search
- Usage statistics tracking
- Support for various image formats

---

### `/meme-template`
**Purpose:** Manage meme template collection

**Usage:**
```
/meme-template add name:"new-template" url:"https://example.com/img.jpg"
/meme-template stats limit:10
```

**Subcommands:**
- `add` - Add new meme template
  - `name` (required) - Template identifier
  - `url` (required) - Image URL
  - `description` (optional) - Template description
  - `fontsize` (optional, 10-100) - Default font size
- `remove` - Delete a template
  - `name` (required, autocomplete) - Template to remove
- `edit` - Modify existing template
  - `name` (required, autocomplete) - Template to edit
  - `url` (optional) - New image URL
  - `description` (optional) - New description
  - `fontsize` (optional, 10-100) - New font size
- `toggle` - Enable/disable template
  - `name` (required, autocomplete) - Template to toggle
- `info` - View template details
  - `name` (required, autocomplete) - Template to view
- `stats` - Template usage statistics
  - `limit` (optional, 1-25) - Number of results

---

## Interactive Commands

### `/poll`
**Purpose:** Create interactive polls with button voting

**Usage:**
```
/poll create question:"What's for lunch?" options:"Pizza, Burgers, Salad" duration:30
/poll results poll_id:"abc123"
/poll close poll_id:"abc123"
```

**Subcommands:**
- `create` - Start a new poll
  - `question` (required) - The poll question
  - `options` (required) - Comma-separated options (max 10)
  - `duration` (optional, 1-1440) - Duration in minutes (default: 60)
- `results` - View current poll results
  - `poll_id` (required) - Unique poll identifier
- `list` - Show your active polls in current channel
- `close` - Manually end your poll
  - `poll_id` (required) - Poll to close

**Features:**
- Interactive button voting
- Real-time progress bars
- Automatic poll expiration
- Vote tracking and analytics

---

### `/rc` (Roll Call)
**Purpose:** Roll Call scoring system for user engagement

**Usage:**
```
/rc for username:"john_doe" interval:"24h"
/rc set score:85
/rc graph username:"jane_doe"
```

**Subcommands:**
- `for` - Get user's RC score
  - `username` (required, autocomplete) - User to check
  - `interval` (optional) - Time period (e.g., "3h", "2d", "1w")
- `set` - Set your own RC score
  - `score` (required, 0-100) - Your current score
- `graph` - Generate score history graph
  - `username` (required, autocomplete) - User for graph

**Features:**
- Username autocomplete based on active users
- Historical score tracking
- Visual graph generation
- Configurable time intervals

---

## Utility Commands

### `/exchange`
**Purpose:** Currency exchange rates and conversion

**Usage:**
```
/exchange source:"BTC" target:"USD" amount:0.5
/exchange source:"EUR" target:"JPY"
```

**Parameters:**
- `source` (required, autocomplete) - Source currency code
- `target` (required, autocomplete) - Target currency code
- `amount` (optional) - Amount to convert (default: 1)

**Features:**
- Fuzzy search autocomplete for currency codes
- Live exchange rates from Coinbase API
- Supports cryptocurrencies and fiat currencies
- Rate caching for performance

---

### `/config`
**Purpose:** Bot configuration management

**Usage:**
```
/config add key:"welcome_message" value:"Hello everyone!"
/config remove key:"old_setting"
```

**Subcommands:**
- `add` - Add new configuration
  - `key` (required) - Configuration key name
  - `value` (required) - Configuration value
- `remove` - Delete configuration
  - `key` (required, autocomplete) - Select from existing keys

**Features:**
- Autocomplete for existing configuration keys
- Transaction safety for database operations

---

## Administrative Commands

### `/motivational-config`
**Purpose:** Set up automated motivational messages

**Permission Required:** Manage Channels

**Usage:**
```
/motivational-config setup channel:#general frequency:daily category:motivation
/motivational-config disable channel:#general
```

**Subcommands:**
- `setup` - Configure automated messages
  - `channel` (required) - Text channel for messages
  - `frequency` (required) - "daily" or "weekly"
  - `category` (required) - "motivation", "productivity", or "general"
  - `schedule` (optional) - Custom cron schedule
- `disable` - Turn off messages for channel
  - `channel` (required) - Channel to disable
- `enable` - Turn on messages for channel
  - `channel` (required) - Channel to enable
- `status` - View current configuration

**Features:**
- Flexible scheduling options
- Multiple message categories
- Per-channel configuration

---

### `/twitch`
**Purpose:** Manage Twitch stream notifications

**Usage:**
```
/twitch subscribe username:"streamer_name"
/twitch unsubscribe
```

**Subcommands:**
- `subscribe` - Start notifications for Twitch user
  - `username` (required) - Twitch username to follow
- `unsubscribe` - Stop current subscription

**Features:**
- Webhook-based real-time notifications
- Automatic stream status updates

---

## Voice Commands

### `/join`
**Purpose:** Make bot join your current voice channel

**Permission Required:** Owner only

**Usage:**
```
/join
```

**Requirements:**
- You must be in a voice channel
- Bot needs Connect permission for that channel

---

### `/leave`
**Purpose:** Make bot leave current voice channel

**Permission Required:** Owner only

**Usage:**
```
/leave
```

**Features:**
- Stops any ongoing TTS or audio playback
- Cleans up voice connection resources

---

### `/speak`
**Purpose:** Text-to-speech in voice channels

**Permission Required:** Owner only

**Usage:**
```
/speak text:"Hello everyone!" voice:"nova" join_user:true
/speak text:"Quick announcement"
```

**Parameters:**
- `text` (required) - Text to speak (length configurable)
- `voice` (optional, autocomplete) - TTS voice selection
- `join_user` (optional) - Join your voice channel first

**Available Voices:**
- Alloy - Balanced, neutral tone
- Echo - Clear, professional
- Fable - Warm, storytelling
- Onyx - Deep, authoritative  
- Nova - Bright, engaging
- Shimmer - Soft, pleasant

**Features:**
- High-quality OpenAI TTS
- Voice autocomplete
- Configurable text length limits

---

## Owner-Only Commands

### `/tts-config`
**Purpose:** Configure text-to-speech settings

**Permission Required:** Owner only

**Usage:**
```
/tts-config show
/tts-config set-voice voice:"echo"
/tts-config set-max-length max_length:500
```

**Subcommands:**
- `show` - Display current TTS configuration
- `set-voice` - Change default TTS voice
  - `voice` (required) - Voice selection
- `set-max-length` - Set maximum text length
  - `max_length` (required, 1-4000) - Character limit
- `reset` - Restore default settings

---

### `/reload`
**Purpose:** Hot-reload specific bot commands during development

**Permission Required:** Developer use

**Usage:**
```
/reload command:"meme"
```

**Parameters:**
- `command` (required) - Command name to reload

**Features:**
- Updates command code without full bot restart
- Useful for development and testing

---

### `/sentry-test`
**Purpose:** Test error monitoring and logging system

**Permission Required:** Owner only

**Usage:**
```
/sentry-test
```

**Features:**
- Verifies Sentry connectivity
- Tests error logging pipeline
- Useful for monitoring system validation

---

## Permission Levels

### Public Commands
All users can use these commands:
- `/adlibs`, `/louds`, `/remember`, `/dadjoke`, `/fear`, `/qr`, `/trivia`
- `/meme`, `/poll`, `/rc`, `/exchange`, `/config`

### Administrative Commands
Require server permissions:
- `/motivational-config` - Needs Manage Channels permission
- `/meme-template` - Template management permissions
- `/twitch` - Subscription management

### Owner-Only Commands
Restricted to bot owner:
- `/speak`, `/join`, `/leave`, `/tts-config`
- `/reload`, `/sentry-test`

---

## Usage Tips

1. **Autocomplete:** Most commands offer autocomplete - start typing and press Tab
2. **Help:** Use `/command-name` without options to see usage hints
3. **Permissions:** Check channel permissions if commands aren't working
4. **Rate Limits:** Some commands have cooldowns to prevent spam
5. **Error Messages:** The bot provides helpful error messages for invalid usage

---

## Command Categories Summary

| Category | Commands | Purpose |
|----------|----------|---------|
| **Content** | adlibs, louds, remember | Manage bot response content |
| **Fun** | dadjoke, fear, qr, meme, trivia | Entertainment and utilities |
| **Interactive** | poll, rc | User engagement features |
| **Utility** | exchange, config | Practical tools |
| **Admin** | motivational-config, twitch | Server management |
| **Voice** | join, leave, speak | Voice channel features |
| **Owner** | reload, sentry-test, tts-config | Bot administration |

For technical support or to report issues with commands, please check the troubleshooting guide or create a GitHub issue.