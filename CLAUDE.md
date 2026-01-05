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
Message responses run in priority-based sequential order in `messageCreate` event:
- `Assistant`: NLP-powered responses (highest priority)
- `Triggers`: Pattern-based responses
- `Adlibs`: Mad-libs style text replacement  
- `Louds`: All-caps message responses (lowest priority)

Only one response per message to prevent conflicts.

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

## Documentation Standards

**CHANGELOG.md:**
Use CHANGELOG.md to track major updates, releases, and significant changes to the project. This helps maintain a clear history of what's been added, changed, or fixed over time.

**PLAN.md:**
Use PLAN.md to plan bigger features before implementation. This should include:
- Feature requirements and scope
- Technical approach and architecture decisions
- Breaking down complex features into actionable tasks
- Dependencies and potential blockers

**GITHUB.md:**
Use GITHUB.md to track GitHub issues, pull requests, and project board status. This provides a centralized view of:
- Open issues and their priority/status
- Active pull requests and review status
- Project milestones and roadmap
- GitHub Actions workflow status

**Additional Documentation Files:**

**DEPLOYMENT.md** - Production deployment guide covering:
- AWS deployment steps and infrastructure setup
- Environment configuration and secrets management
- Docker deployment instructions and containerization
- CI/CD pipeline documentation and automated deployments

**TROUBLESHOOTING.md** - Common issues and solutions including:
- Database connection problems and MySQL troubleshooting
- Discord API rate limiting and token issues
- OpenAI API errors and integration problems
- Bot permission issues and Discord setup problems

**CONTRIBUTING.md** - Development contribution guidelines covering:
- Code style standards and ESLint configuration
- Testing requirements and Jest framework usage
- PR review process and branch protection rules
- Development environment setup and prerequisites

**COMMANDS.md** - User-facing command documentation including:
- Complete list of available slash commands
- Command usage examples with parameters
- Permission requirements and role restrictions
- Command categories and feature descriptions

**CLAUDE.md Files in Subfolders:**
Each significant subfolder should contain its own CLAUDE.md file that documents:

1. **Purpose of the folder** - What this directory contains and its role in the project
2. **File inventory** - List of files with brief descriptions of their purpose
3. **Function overview** - High-level description of what each major function/class does
4. **Dependencies** - What external modules or internal components are used
5. **Usage patterns** - How files in this folder are typically used or imported

**Example structure:**
```
src/commands/CLAUDE.md       # Documents all slash commands
src/responses/CLAUDE.md      # Documents message response handlers  
src/utils/CLAUDE.md          # Documents utility functions
src/models/CLAUDE.md         # Documents database models
src/services/CLAUDE.md       # Documents service classes
events/CLAUDE.md             # Documents Discord event handlers
```

**Documentation Template:**
```markdown
# [Folder Name] - CLAUDE.md

## Purpose
Brief description of this directory's role in the project.

## Files Overview
- `filename.ts` - Brief description of purpose
- `another-file.ts` - What this file handles

## Key Functions/Classes
- `functionName()` - What it does and when it's used
- `ClassName` - Purpose and main methods

## Dependencies
- External: List of npm packages used
- Internal: Other project folders/files referenced
```

**Benefits:**
- Helps Claude Code understand codebase structure quickly
- Provides context for making changes within specific areas
- Makes it easier to maintain consistency across similar files
- Assists in identifying the right place to add new functionality

## Git Workflow

**IMPORTANT:** Master branch is protected and requires pull requests for ALL changes.

**Pull Request Workflow:**
1. Create feature branch: `git checkout -b feature/description-issue-number`
2. Make changes and commit with descriptive messages
3. Push feature branch: `git push -u origin feature/description-issue-number`  
4. Create pull request via GitHub CLI: `gh pr create --title "feat: description" --body "detailed description"`
5. NEVER commit directly to master - always use PRs for proper review and CI checks

**Branch Naming Convention:**
- Features: `feature/description-issue-number`
- Bug fixes: `fix/description-issue-number`
- Documentation: `docs/description`

**Git Rules for Claude:**
- NEVER run `git push --force` or `git push --force-with-lease`
- NEVER run `gh pr merge` - only the user merges PRs
- NEVER use `--admin` flag to bypass branch protection
- Stop after creating a PR and let the user review/merge

## Available Tools & Access

**AWS CLI Access:**
- Full AWS CLI access available for checking Systems Manager parameters, CloudWatch logs, etc.
- Use `aws ssm get-parameter --name "parameter-name"` to check parameter store values
- Use `aws logs describe-log-groups` and `aws logs filter-log-events` for CloudWatch logs
- Bot deployment likely uses Systems Manager for environment variables in production

**Sentry CLI Access:**
- `sentry-cli` available for checking events, issues, and logs
- Organization: `derek-robati` 
- Project: `alia-bot`
- Use `sentry-cli events --org derek-robati --project alia-bot list` to check recent events
- Use `sentry-cli projects list --org derek-robati` to see available projects

## Recommended Claude Code Agents

When working on this Discord bot project, use these specialized agents for optimal results:

### **backend-architect**
**Use for:** API design, database architecture, and server-side logic
- Designing new Discord command endpoints
- Optimizing database queries and Sequelize models
- Implementing authentication and permission systems
- Architecting scalable bot response systems

### **devops-automator** 
**Use for:** Deployment, infrastructure, and operational tasks
- Setting up CI/CD pipelines for bot deployment
- Configuring AWS infrastructure (ECS, RDS, Parameter Store)
- Implementing monitoring and alerting systems
- Managing Docker containerization and deployment

### **test-writer-fixer**
**Use for:** Testing strategy and test maintenance
- Writing comprehensive tests for Discord commands
- Testing message response handlers and event listeners
- Creating integration tests for database operations
- Maintaining Jest test coverage requirements (40% minimum)

### **ai-engineer**
**Use for:** OpenAI integration and NLP features
- Implementing OpenAI TTS voice features
- Enhancing the assistant response system
- Working with Natural.js Bayesian classifier
- Integrating new AI-powered bot capabilities

### **troubleshooting-expert**
**Use for:** Debugging and issue resolution
- Resolving Discord API rate limiting issues
- Debugging database connection problems
- Troubleshooting voice channel connectivity
- Analyzing Sentry error logs and performance issues

### **performance-benchmarker**
**Use for:** Bot optimization and scaling
- Analyzing bot response times and memory usage
- Optimizing message processing performance
- Load testing Discord command handling
- Identifying bottlenecks in database operations

### **security-auditor**
**Use for:** Security reviews and compliance
- Auditing bot permissions and access controls
- Reviewing environment variable and secret management
- Ensuring secure Discord token handling
- Validating owner-only command restrictions

### **discord-interaction-designer**
**Use for:** Discord-specific UX design and bot interaction patterns
- Designing intuitive slash command structures and parameter layouts
- Creating user-friendly command hierarchies (like `/meme` subcommands)
- Optimizing autocomplete experiences for better command discovery
- Designing bot personality and response tone across different contexts
- Planning voice channel interaction flows (join/leave/TTS patterns)
- Creating effective embed layouts and button interaction designs
- Designing permission-aware UX (owner-only vs public command clarity)
- Improving error message UX to be helpful rather than frustrating
- Planning user onboarding flows for bot feature discovery
- Designing social dynamics considerations for server-wide bot usage

### **sprint-prioritizer**
**Use for:** Feature planning, roadmap management, and development prioritization
- Analyzing the 29+ open GitHub issues for priority ranking
- Planning 6-day development cycles with realistic scope
- Making trade-off decisions between new features vs bug fixes
- Balancing user requests (commands, entertainment) vs technical debt
- Prioritizing critical issues (like security vulnerabilities) vs enhancements
- Managing the backlog of requested commands (/youtube, /reddit, /crypto, etc.)
- Deciding between infrastructure improvements vs user-facing features
- Coordinating releases with Discord API changes and OpenAI updates

### **general-purpose**
**Use for:** Complex multi-step tasks or when unsure
- Comprehensive code refactoring across multiple files
- Large feature implementations spanning commands, responses, and database
- Complex searches across the entire codebase
- Any task requiring analysis of multiple components

## Important Instructions

Do what has been asked; nothing more, nothing less.
NEVER create files unless they're absolutely necessary for achieving your goal.
ALWAYS prefer editing an existing file to creating a new one.
NEVER proactively create documentation files (*.md) or README files. Only create documentation files if explicitly requested by the User.
NEVER add Claude Code attributions to commits, PRs, or other git operations.