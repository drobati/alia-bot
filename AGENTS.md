# AGENTS.md - AI Coding Assistant Guide

> This document is optimized for AI coding assistants working on alia-bot. It provides context not found in README.md or CONTRIBUTING.md, focusing on file purposes, coding patterns, and development workflows.

## Quick Context

**Alia-bot** is a Discord bot for the Arrakis Discord guild with:
- **51 slash commands** across entertainment, gaming, voice, and utilities
- **8 message response handlers** with priority-based processing
- **21 database models** using Sequelize ORM with MySQL
- **4 services** for voice, scheduling, economy, and events

**Tech Stack:** TypeScript, Discord.js v14, MySQL 8.0, Sequelize, OpenAI, Node.js 24

---

## Directory Structure

```
alia-bot/
├── src/                          # All application source code
│   ├── commands/                 # 51 slash command handlers
│   │   ├── arc.ts               # Arc Raiders item lookup
│   │   ├── meme.ts              # Meme generation with templates
│   │   ├── poll.ts              # Interactive polls with voting
│   │   ├── speak.ts             # Voice TTS using OpenAI
│   │   └── ...                  # See components.md for full list
│   │
│   ├── responses/               # 8 message response handlers (priority order)
│   │   ├── assistant.ts         # OpenAI NLP responses (priority 3)
│   │   ├── triggers.ts          # Pattern matching (priority 4)
│   │   ├── adlibs.ts            # Mad-libs replacement (priority 5)
│   │   ├── louds.ts             # ALL-CAPS responses (priority 6)
│   │   └── ...                  # verification, dnd, tips, greetings
│   │
│   ├── models/                  # 21 Sequelize database models
│   │   ├── config.ts            # Key-value bot configuration
│   │   ├── Poll.ts              # Poll questions and metadata
│   │   ├── SparksBalance.ts     # Economy system balances
│   │   └── ...                  # See data_models.md for schema
│   │
│   ├── services/                # 4 business logic services
│   │   ├── voice.ts             # VoiceService - TTS and voice channels
│   │   ├── motivationalScheduler.ts  # Cron-based quote scheduling
│   │   ├── sparksService.ts     # Economy system management
│   │   └── schedulerService.ts  # Event scheduling and reminders
│   │
│   ├── lib/                     # Core libraries
│   │   ├── sentry.ts            # Error tracking initialization
│   │   ├── server.ts            # HTTP webhook server
│   │   └── apis/                # External API clients
│   │       ├── metaforge.ts     # Arc Raiders game API
│   │       ├── opendota.ts      # Dota 2 statistics
│   │       └── twitch.ts        # Twitch stream notifications
│   │
│   ├── utils/                   # 14+ utility modules
│   │   ├── types.ts             # Core TypeScript interfaces
│   │   ├── logger.ts            # Bunyan structured logging
│   │   ├── permissions.ts       # Owner permission validation
│   │   ├── assistant.ts         # OpenAI thread management
│   │   ├── hybrid-classifier.ts # Bayesian + keyword NLP
│   │   └── ...                  # See components.md for full list
│   │
│   └── types/                   # TypeScript definitions
│       ├── database.ts          # Sequelize model types
│       └── discord.ts           # Discord.js extensions
│
├── events/                      # 10 Discord event handlers
│   ├── ready.ts                 # Bot initialization
│   ├── messageCreate.ts         # Message response routing
│   ├── interactionCreate.ts     # Slash command routing
│   └── ...                      # Guild events, voice events
│
├── migrations/                  # Sequelize database migrations
├── config/                      # YAML configuration files
├── scripts/                     # Deployment and utility scripts
├── .github/workflows/           # CI/CD pipelines
├── index.ts                     # Main entry point
└── .sop/summary/               # Generated documentation
```

---

## Coding Patterns

### 1. Command Structure

All slash commands follow this pattern:

```typescript
// src/commands/example.ts
import { SlashCommandBuilder, ChatInputCommandInteraction } from 'discord.js';
import { Context } from '../utils/types';

export const data = new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command')
    .addStringOption(option =>
        option.setName('query')
            .setDescription('Search query')
            .setRequired(true)
            .setAutocomplete(true));

export async function execute(
    interaction: ChatInputCommandInteraction,
    context: Context
): Promise<void> {
    const query = interaction.options.getString('query', true);
    // Implementation
    await interaction.reply({ content: `Result: ${query}` });
}

// Optional autocomplete handler
export async function autocomplete(
    interaction: AutocompleteInteraction,
    context: Context
): Promise<void> {
    const focused = interaction.options.getFocused();
    const choices = [/* filtered options */];
    await interaction.respond(choices.slice(0, 25));
}
```

### 2. Response Handler Pattern

Message responses use priority-based processing:

```typescript
// src/responses/example.ts
import { Message } from 'discord.js';
import { Context } from '../utils/types';

export async function canHandle(
    message: Message,
    context: Context
): Promise<boolean> {
    // Return true if this handler should process the message
    return message.content.includes('keyword');
}

export async function execute(
    message: Message,
    context: Context
): Promise<boolean> {
    // Process message and reply
    await message.reply('Response');
    return true; // Return true to stop chain, false to continue
}
```

### 3. Event Handler Pattern

```typescript
// events/example.ts
import { Events } from 'discord.js';
import { BotEvent } from '../src/utils/types';

const eventHandler: BotEvent = {
    name: Events.EventName,
    once: false,  // true for one-time events like 'ready'
    async execute(...args, context) {
        // Handle event
    }
};

export default eventHandler;
```

### 4. Database Model Pattern

```typescript
// src/models/Example.ts
import { DataTypes, Sequelize, Model, ModelCtor } from 'sequelize';

export default function(sequelize: Sequelize): ModelCtor<Model> {
    return sequelize.define('Example', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        // More fields...
    }, {
        tableName: 'examples',
        timestamps: true,
    });
}
```

### 5. Context Object

The shared Context is passed to all handlers:

```typescript
interface Context {
    tables: {
        Adlibs: ModelCtor<Model>;
        Config: ModelCtor<Model>;
        // ... all 21 models
    };
    log: Logger;              // Bunyan logger
    sequelize: Sequelize;     // Database connection
    VERSION: string;          // Bot version
    voiceService: VoiceService;
    motivationalScheduler: MotivationalScheduler;
    sparksService: SparksService;
}
```

---

## Testing Patterns

### Jest Configuration

- **Framework:** Jest with ts-jest
- **Coverage Threshold:** 88% statements, 69% branches, 90% functions
- **Test Location:** `.test.ts` files alongside source

### Writing Tests

```typescript
// src/commands/example.test.ts
import { execute, data } from './example';
import { createMockInteraction, createMockContext } from '../utils/testHelpers';

describe('example command', () => {
    it('should respond with correct message', async () => {
        const interaction = createMockInteraction({
            commandName: 'example',
            options: { query: 'test' }
        });
        const context = createMockContext();

        await execute(interaction, context);

        expect(interaction.reply).toHaveBeenCalledWith(
            expect.objectContaining({ content: expect.stringContaining('test') })
        );
    });
});
```

### Running Tests

```bash
npm test                    # Run all tests
npm run coverage            # Run with coverage report
npm test -- --watch         # Watch mode
npm test -- path/to/file    # Single file
```

---

## File Organization Patterns

### Adding a New Slash Command

1. Create `src/commands/newcommand.ts`
2. Export `data` (SlashCommandBuilder) and `execute` function
3. Optionally add `autocomplete` function
4. Command auto-loads on bot restart
5. Add test file `src/commands/newcommand.test.ts`

### Adding a New Database Model

1. Create migration: `npm run sequelize-cli -- migration:generate --name add-new-table`
2. Edit migration file in `migrations/`
3. Create `src/models/NewModel.ts` with factory function
4. Run migration: `npm run sequelize-cli -- db:migrate`
5. Model auto-loads and adds to `context.tables`

### Adding a Message Response Handler

1. Create `src/responses/newhandler.ts`
2. Export `canHandle` and `execute` functions
3. Add to priority chain in `events/messageCreate.ts`
4. Add test file `src/responses/newhandler.test.ts`

### Adding an External API Integration

1. Create `src/lib/apis/newapi.ts`
2. Implement client class with error handling
3. Add caching if appropriate (use lru-cache)
4. Add Sentry context for error tracking
5. Export and use in commands/responses

---

## Important Conventions

### Logging

Always use the Bunyan logger from context, never `console.log`:

```typescript
context.log.info({ userId, guildId }, 'Action completed');
context.log.error({ err }, 'Operation failed');
```

### Error Handling

Wrap external calls with try/catch and Sentry:

```typescript
import * as Sentry from '@sentry/node';

try {
    const result = await externalApi.call();
} catch (error) {
    Sentry.captureException(error);
    context.log.error({ err: error }, 'API call failed');
    // Handle gracefully
}
```

### Owner-Only Commands

Use the permission utility for restricted commands:

```typescript
import { checkOwnerPermission } from '../utils/permissions';

export async function execute(interaction, context) {
    if (!await checkOwnerPermission(interaction.user.id, context)) {
        await interaction.reply({ content: 'Owner only', ephemeral: true });
        return;
    }
    // Owner-only logic
}
```

### Database Queries

Use Sequelize model methods:

```typescript
// Find
const item = await context.tables.Config.findOne({ where: { key: 'setting' } });

// Create
await context.tables.Memories.create({ guildId, key, value, createdBy });

// Update
await item.update({ value: newValue });

// Delete
await context.tables.Louds.destroy({ where: { id } });
```

---

## Response Priority Order

When adding message responses, understand the priority chain:

| Priority | Handler | File | Stops Chain |
|----------|---------|------|-------------|
| 1 | Verification | `verification.ts` | Yes |
| 2 | D&D | `dnd.ts` | Yes |
| 3 | Assistant | `assistant.ts` | Yes (70% confidence) |
| 4 | Triggers | `triggers.ts` | Yes |
| 5 | Adlibs | `adlibs.ts` | Yes |
| 6 | Louds | `louds.ts` | Yes |
| 7 | Tips | `tips.ts` | Yes |
| 8 | Greetings | `greetings.ts` | Yes |

Only ONE response per message. First match wins.

---

## Service Usage

### VoiceService

```typescript
// Join voice channel
await context.voiceService.joinChannel(voiceChannel, guildId);

// Play TTS
await context.voiceService.speak(text, 'nova', guildId);

// Leave
await context.voiceService.leaveChannel(guildId);
```

### SparksService

```typescript
// Get balance
const balance = await context.sparksService.getBalance(userId);

// Add sparks
await context.sparksService.addSparks(userId, amount);

// Transfer
await context.sparksService.transfer(fromId, toId, amount);
```

---

## Build and Run

```bash
# Development
npm run build              # Compile TypeScript
npm start                  # Run bot

# Database
docker-compose up -d mysqldb    # Start MySQL
npm run sequelize-cli -- db:migrate  # Run migrations

# Testing
npm test                   # Run tests
npm run coverage           # Coverage report
npm run lint               # ESLint
```

---

## Git Workflow

**Master branch is protected - always use PRs:**

```bash
git checkout -b feature/description
# Make changes
git add .
git commit -m "feat: description"
git push -u origin feature/description
gh pr create --title "feat: description" --body "Details"
```

**Never:**
- Commit directly to master
- Force push
- Skip CI checks

---

## Environment Variables

Required in `.env`:
```
BOT_TOKEN=discord_bot_token
NODE_ENV=development
MYSQLDB_DATABASE=aliadb
MYSQLDB_USER=aliabot
MYSQLDB_PASSWORD=password
OPENAI_API_KEY=sk-...
```

Optional:
```
DB_HOST=localhost
POLYGON_API_KEY=...
SENTRY_DSN=...
```

---

## Detailed Documentation

For in-depth information, see `.sop/summary/`:

| File | Contents |
|------|----------|
| `index.md` | Documentation navigation guide |
| `architecture.md` | System design and patterns |
| `components.md` | All commands, handlers, models |
| `interfaces.md` | API integrations |
| `data_models.md` | Database schema |
| `workflows.md` | Process flows |
| `dependencies.md` | Package information |
