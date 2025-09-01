# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Alia-bot is a Discord bot built with Discord.js v14, TypeScript, and MySQL/Sequelize. The bot serves the "Arrakis Discord" guild and features both slash commands and message-based responses including an OpenAI integration for general knowledge questions.

## Development Commands

**Build and Run:**
```bash
npm run build          # Compile TypeScript to dist/
npm start              # Run the compiled bot from dist/index.js
```

**Development:**
```bash
npm run lint           # Run ESLint
npm run test           # Run Jest tests
npm run coverage       # Run Jest with coverage report
```

**Database:**
```bash
# Start MySQL database
docker-compose up -d mysqldb

# Run migrations
npm run sequelize-cli -- db:migrate

# Create new migration
npm run sequelize-cli -- migration:generate --name migration-name
```

## Architecture

### Core Structure

The bot follows an event-driven architecture with three main execution paths:

1. **Slash Commands** (`src/commands/`) - Registered Discord slash commands
2. **Message Responses** (`src/responses/`) - Automatic responses to message content
3. **Event Handlers** (`events/`) - Discord.js event listeners

### Key Components

**Main Entry Point (`index.ts`):**
- Initializes Discord client with required intents (Guilds, GuildMessages, MessageContent)
- Sets up Sequelize database connection
- Creates shared `Context` object containing database tables, logger, and utilities
- Dynamically loads commands and events from their respective directories

**Context System:**
All major functions receive a `Context` object containing:
- `tables`: All Sequelize models (dynamically loaded from `src/models/`)
- `log`: Bunyan logger instance
- `sequelize`: Database connection
- `VERSION`: Bot version string

**Command Structure:**
Commands export objects with:
- `data`: Command definition (name, description, options)
- `execute`: Main command handler function
- `autocomplete`: Optional autocomplete handler

**Response System (`src/responses/`):**
Message responses run in parallel via `Promise.allSettled()` in `messageCreate` event:
- `Louds`: Responds to all-caps messages
- `Adlibs`: Mad-libs style text replacement
- `Triggers`: Pattern-based responses
- `Assistant` (new): OpenAI-powered responses using Bayesian classification

### Database Models

Located in `src/models/`, each model file exports a function that takes a Sequelize instance and returns model definitions. Models are automatically loaded and added to the context.tables object.

Available models: Adlibs, Config, Louds, Memories, RollCall, Twitch

### OpenAI Integration

The new assistant system (`src/responses/assistant.ts` and `src/utils/assistant.ts`) uses:
- **Natural.js Bayesian classifier** to categorize messages into intents
- **OpenAI API** to generate responses for "general-knowledge" category messages
- **Confidence threshold** (70%) to prevent over-responding
- **Persistent thread management** stored in Config table

## Configuration

**Environment Variables (.env):**
```
BOT_TOKEN=your_discord_bot_token
NODE_ENV=development|production
MYSQLDB_DATABASE=aliadb
MYSQLDB_USER=aliabot
MYSQLDB_PASSWORD=your_mysql_password
OPENAI_API_KEY=your_openai_api_key
```

**Config System:**
YAML-based configuration in `config/` directory with environment-specific overrides. Access via `config.get('key.path')`.

## Testing

- **Framework**: Jest with ts-jest preset
- **Location**: `.test.ts` files alongside source files
- **Coverage**: Available via `npm run coverage`
- **Test Environment**: Uses separate test database configuration

## Development Notes

**TypeScript Configuration:**
- Target: ES2016
- Strict mode enabled
- Source maps generated for debugging
- Output to `dist/` directory

**File Loading Pattern:**
The bot uses a dynamic file loading system (`loadFiles` function) that:
- Scans directories for `.js` files (compiled TypeScript)
- Excludes test files automatically
- Handles both commands and events uniformly

**Database Migration Workflow:**
1. Create migration: `scripts/createMigration <name>`
2. Edit generated migration file
3. Run migration: `scripts/runMigration`

**Docker Development:**
The project includes Docker Compose setup for MySQL development database. Use provided scripts in `scripts/` directory for database management.

## Git Workflow

**IMPORTANT:** Master branch is protected and requires pull requests for ALL changes.

**Pull Request Workflow:**
1. Create feature branch: `git checkout -b feature/description-issue-number`
2. Make changes and commit with descriptive messages
3. Push feature branch: `git push -u origin feature/description-issue-number`  
4. Create pull request via GitHub CLI: `gh pr create --title "feat: description" --body "detailed description"`
5. **STOP HERE** - Wait for human review and approval
6. NEVER commit directly to master - always use PRs for proper review and CI checks

**CRITICAL: Claude Code MUST NOT merge pull requests automatically:**
- NEVER use `gh pr merge` command without explicit user instruction
- NEVER use `--admin`, `--auto`, or other flags to bypass branch protection
- NEVER merge PRs even if asked to "deploy" - deployment happens AFTER human review
- CREATE the PR, then WAIT for human to review, approve, and merge
- Only proceed with deployment AFTER the human has merged the PR

**Branch Naming Convention:**
- Features: `feature/description-issue-number`
- Bug fixes: `fix/description-issue-number`
- Documentation: `docs/description`