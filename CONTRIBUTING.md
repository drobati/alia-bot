# Contributing Guide

> Guidelines for contributing to Alia-bot development

## Table of Contents
- [Getting Started](#getting-started)
- [Development Environment](#development-environment)
- [Code Style Standards](#code-style-standards)
- [Testing Requirements](#testing-requirements)
- [Pull Request Process](#pull-request-process)
- [Project Structure](#project-structure)
- [Commit Guidelines](#commit-guidelines)

## Getting Started

### Prerequisites
- Node.js 20+ 
- Docker and Docker Compose
- MySQL 8.0+
- Git
- Discord Developer Account
- OpenAI API Access

### Repository Setup

1. **Fork and Clone:**
```bash
# Fork repository on GitHub, then:
git clone https://github.com/YOUR_USERNAME/alia-bot.git
cd alia-bot
```

2. **Install Dependencies:**
```bash
npm install
```

3. **Environment Configuration:**
```bash
# Copy environment template
cp .env.example .env

# Edit with your values
nano .env
```

4. **Database Setup:**
```bash
# Start MySQL
docker-compose up -d mysqldb

# Run migrations
npm run sequelize-cli -- db:migrate

# Verify database connection
npm run test -- --testNamePattern="database"
```

## Development Environment

### Required Environment Variables

```env
# Core Configuration
NODE_ENV=development
BOT_TOKEN=your_discord_bot_token
GUILD_ID=your_test_guild_id

# Database
MYSQLDB_DATABASE=aliadb
MYSQLDB_USER=aliabot
MYSQLDB_PASSWORD=your_secure_password
MYSQLDB_ROOT_PASSWORD=your_root_password
MYSQLDB_LOCAL_PORT=3306
MYSQLDB_DOCKER_PORT=3306

# Optional for full feature testing
OPENAI_API_KEY=your_openai_api_key
SENTRY_DSN=your_sentry_dsn
```

### Development Commands

```bash
# Build TypeScript
npm run build

# Run in development (auto-restart)
npm run dev

# Lint code
npm run lint

# Run tests
npm run test

# Test with coverage
npm run coverage

# Database operations
npm run sequelize-cli -- db:migrate
npm run sequelize-cli -- db:migrate:undo
```

### Docker Development

```bash
# Start database only
docker-compose up -d mysqldb

# Start full development stack
docker-compose up -d

# View logs
docker-compose logs -f app

# Restart services
docker-compose restart
```

## Code Style Standards

### ESLint Configuration

The project uses strict ESLint rules defined in `.eslintrc.json`:

**Key Rules:**
- **Indentation:** 4 spaces
- **Max Line Length:** 120 characters
- **No Console:** Use Bunyan logger instead of `console.log`
- **Strict Equality:** Always use `===` and `!==`
- **Arrow Functions:** Prefer arrow functions where appropriate
- **Trailing Commas:** Required in multiline structures
- **TypeScript:** Strict type checking enabled

**Example Code Style:**

```typescript
// ✅ Good
import { SlashCommandBuilder, CommandInteraction } from 'discord.js';
import { Context } from '../types/Context';

export const data = new SlashCommandBuilder()
    .setName('example')
    .setDescription('Example command with proper formatting');

export async function execute(interaction: CommandInteraction, context: Context): Promise<void> {
    const { tables, log } = context;
    
    try {
        const result = await tables.ExampleModel.findOne({
            where: { id: interaction.user.id },
        });
        
        if (!result) {
            return interaction.reply({ 
                content: 'No data found!', 
                ephemeral: true,
            });
        }
        
        log.info({ userId: interaction.user.id }, 'Command executed successfully');
        await interaction.reply(`Hello ${interaction.user.displayName}!`);
    } catch (error) {
        log.error(error, 'Command execution failed');
        await interaction.reply({ 
            content: 'An error occurred!', 
            ephemeral: true,
        });
    }
}

// ❌ Bad
export async function execute(interaction,context) {
  console.log("executing command"); // No console.log!
  let result = await context.tables.ExampleModel.findOne({where:{id:interaction.user.id}}) // Missing spaces, semicolon
  if(result==null) return; // Use === and proper formatting
}
```

### TypeScript Guidelines

1. **Explicit Types:**
```typescript
// ✅ Good - explicit return types
async function getUserData(id: string): Promise<UserData | null> {
    return await User.findByPk(id);
}

// ❌ Avoid - implicit any
async function getUserData(id) {
    return await User.findByPk(id);
}
```

2. **Interface Definitions:**
```typescript
// ✅ Good - clear interface
interface CommandContext {
    tables: DatabaseTables;
    log: Logger;
    sequelize: Sequelize;
    VERSION: string;
}

// ❌ Avoid - any types
interface CommandContext {
    [key: string]: any;
}
```

3. **Error Handling:**
```typescript
// ✅ Good - typed error handling
try {
    await riskyOperation();
} catch (error) {
    if (error instanceof DiscordAPIError) {
        log.warn({ error: error.message }, 'Discord API error');
    } else {
        log.error(error, 'Unexpected error');
    }
}
```

### File Naming Conventions

- **Commands:** `kebab-case.ts` (e.g., `user-stats.ts`)
- **Models:** `PascalCase.ts` (e.g., `UserProfile.ts`)
- **Utilities:** `camelCase.ts` (e.g., `messageParser.ts`)
- **Types:** `PascalCase.ts` (e.g., `Context.ts`)

## Testing Requirements

### Testing Framework: Jest + TypeScript

**Test File Location:**
- Unit tests: `src/**/*.test.ts`
- Integration tests: `tests/integration/**/*.test.ts`

**Coverage Requirements:**
- **Statements:** 40% minimum
- **Branches:** 30% minimum  
- **Functions:** 50% minimum
- **Lines:** 40% minimum

### Writing Tests

**Command Testing Example:**
```typescript
// src/commands/ping.test.ts
import { execute } from './ping';
import { mockInteraction, mockContext } from '../../tests/mocks';

describe('Ping Command', () => {
    it('should respond with pong', async () => {
        const interaction = mockInteraction();
        const context = mockContext();
        
        await execute(interaction, context);
        
        expect(interaction.reply).toHaveBeenCalledWith('Pong!');
    });
    
    it('should handle errors gracefully', async () => {
        const interaction = mockInteraction();
        const context = mockContext();
        
        // Mock database error
        context.tables.Config.findOne = jest.fn().mockRejectedValue(new Error('DB Error'));
        
        await execute(interaction, context);
        
        expect(interaction.reply).toHaveBeenCalledWith({
            content: 'An error occurred!',
            ephemeral: true,
        });
    });
});
```

**Database Model Testing:**
```typescript
// src/models/User.test.ts
import { sequelize } from '../database';
import { User } from './User';

describe('User Model', () => {
    beforeAll(async () => {
        await sequelize.sync({ force: true });
    });
    
    afterAll(async () => {
        await sequelize.close();
    });
    
    it('should create user with valid data', async () => {
        const userData = {
            discordId: '123456789',
            username: 'testuser',
        };
        
        const user = await User.create(userData);
        
        expect(user.discordId).toBe(userData.discordId);
        expect(user.username).toBe(userData.username);
        expect(user.id).toBeDefined();
    });
});
```

### Test Utilities

Create reusable mocks in `tests/mocks/`:

```typescript
// tests/mocks/discord.ts
export function mockInteraction() {
    return {
        reply: jest.fn(),
        user: { id: '123456789', displayName: 'TestUser' },
        guild: { id: '987654321' },
        commandName: 'test',
    };
}

// tests/mocks/context.ts
export function mockContext() {
    return {
        tables: {
            Config: { findOne: jest.fn(), create: jest.fn() },
            User: { findOne: jest.fn(), create: jest.fn() },
        },
        log: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
        },
        sequelize: {},
        VERSION: '1.0.0',
    };
}
```

### Running Tests

```bash
# Run all tests
npm test

# Run specific test file
npm test -- ping.test.ts

# Run tests in watch mode
npm test -- --watch

# Generate coverage report
npm run coverage

# Run tests with debugging
npm test -- --verbose
```

## Pull Request Process

### Branch Strategy

**IMPORTANT:** Master branch is protected. All changes must go through pull requests.

**Branch Naming:**
- Features: `feature/description-issue-number`
- Bug fixes: `fix/description-issue-number`
- Documentation: `docs/description`
- Refactoring: `refactor/description`

### PR Workflow

1. **Create Feature Branch:**
```bash
git checkout -b feature/add-user-profiles-123
```

2. **Make Changes:**
```bash
# Make your changes
git add .
git commit -m "feat: add user profile command with database integration"
```

3. **Pre-PR Checklist:**
```bash
# Lint your code
npm run lint

# Run tests
npm run test

# Build successfully
npm run build

# Check types
npx tsc --noEmit
```

4. **Push and Create PR:**
```bash
git push -u origin feature/add-user-profiles-123

# Create PR via GitHub CLI
gh pr create --title "feat: add user profile command" \
             --body "Adds /profile command with user data storage and retrieval"
```

### PR Requirements

**Required Checks:**
- [ ] All tests passing
- [ ] ESLint passes with no errors
- [ ] TypeScript compiles without errors
- [ ] Code coverage meets minimums
- [ ] No merge conflicts

**PR Description Template:**
```markdown
## Description
Brief description of what this PR does.

## Type of Change
- [ ] Bug fix (non-breaking change which fixes an issue)
- [ ] New feature (non-breaking change which adds functionality)  
- [ ] Breaking change (fix or feature that would cause existing functionality to not work as expected)
- [ ] Documentation update

## Testing
- [ ] Added/updated unit tests
- [ ] Tested manually in development
- [ ] Integration tests pass

## Checklist
- [ ] Code follows style guidelines
- [ ] Self-review completed
- [ ] Documentation updated if needed
- [ ] No console.log statements
- [ ] Error handling implemented
```

### Code Review Guidelines

**For Reviewers:**
- Check for security issues
- Verify error handling
- Ensure logging instead of console
- Validate TypeScript types
- Test command functionality
- Review database queries for efficiency

**For Authors:**
- Address all review feedback
- Update tests if logic changes
- Ensure CI passes before requesting review
- Provide clear PR description

## Project Structure

### Directory Organization

```
alia-bot/
├── src/
│   ├── commands/           # Slash command implementations
│   ├── responses/          # Message response handlers
│   ├── models/            # Database models (Sequelize)
│   ├── utils/             # Utility functions
│   ├── types/             # TypeScript type definitions
│   ├── services/          # Business logic services
│   ├── lib/               # External library wrappers
│   └── data/              # Static data files
├── events/                # Discord.js event handlers
├── config/                # Configuration files (YAML)
├── tests/                 # Test files and mocks
├── docs/                  # Additional documentation
└── scripts/               # Utility scripts
```

### Adding New Features

**1. Commands:**
```typescript
// src/commands/new-command.ts
import { SlashCommandBuilder } from 'discord.js';
import { Context } from '../types/Context';

export const data = new SlashCommandBuilder()
    .setName('newcommd')
    .setDescription('Description of the new command');

export async function execute(interaction, context: Context) {
    // Implementation
}
```

**2. Response Handlers:**
```typescript
// src/responses/new-response.ts
import { Message } from 'discord.js';
import { Context } from '../types/Context';

export async function handleNewResponse(message: Message, context: Context): Promise<boolean> {
    if (!message.content.includes('trigger')) {
        return false; // Didn't handle
    }
    
    await message.reply('Response!');
    return true; // Handled
}
```

**3. Database Models:**
```typescript
// src/models/NewModel.ts
import { DataTypes, Sequelize } from 'sequelize';

export default function(sequelize: Sequelize) {
    return sequelize.define('NewModel', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        // Other fields
    });
}
```

## Commit Guidelines

### Commit Message Format

Use [Conventional Commits](https://www.conventionalcommits.org/):

```
<type>[optional scope]: <description>

[optional body]

[optional footer(s)]
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code style changes (formatting, etc.)
- `refactor`: Code refactoring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks

**Examples:**
```bash
feat(commands): add user profile command with database integration

fix(responses): resolve assistant response confidence threshold issue

docs: update API documentation for OpenAI integration

test(commands): add comprehensive tests for roll command

refactor(utils): extract message parsing logic into separate utility
```

### Commit Best Practices

1. **Small, focused commits**
2. **Clear, descriptive messages**
3. **Test before committing**
4. **One logical change per commit**

## Getting Help

### Development Resources
- **Discord.js Guide:** https://discordjs.guide/
- **Sequelize Docs:** https://sequelize.org/docs/
- **TypeScript Handbook:** https://www.typescriptlang.org/docs/
- **Jest Testing:** https://jestjs.io/docs/

### Project Communication
- **Issues:** Use GitHub Issues for bug reports and feature requests
- **Discussions:** Use GitHub Discussions for questions
- **Code Review:** All code changes reviewed via pull requests

### Common Development Tasks

```bash
# Add new command
npm run create-command -- command-name

# Add new migration
npm run sequelize-cli -- migration:generate --name add-new-table

# Register commands with Discord
node scripts/register-commands.js

# Clear Discord commands (development)
node scripts/clear-commands.js

# Database reset (development only)
npm run sequelize-cli -- db:drop
npm run sequelize-cli -- db:create
npm run sequelize-cli -- db:migrate
```

---

**Questions?** Feel free to open a GitHub Discussion or reach out to project maintainers.