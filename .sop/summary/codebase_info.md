# Codebase Information

## Project Overview

| Property | Value |
|----------|-------|
| **Name** | alia-bot |
| **Description** | Feature-rich Discord bot for the Arrakis Discord guild |
| **Version** | 1.0.0 |
| **Repository** | https://github.com/desert-planet/alia |
| **License** | MIT |
| **Author** | derek.robati@gmail.com |

## Technology Stack

### Core Technologies

| Category | Technology | Version |
|----------|------------|---------|
| Runtime | Node.js | 24 |
| Language | TypeScript | Latest (Strict mode) |
| Discord API | discord.js | 14.13.0 |
| Database | MySQL | 8.0 |
| ORM | Sequelize | 6.29.0 |
| Package Manager | npm | Latest |

### Primary Frameworks & Libraries

| Purpose | Library | Version |
|---------|---------|---------|
| Discord Voice | @discordjs/voice | 0.19.0 |
| AI/NLP | openai | 4.20.1 |
| NLP Classification | natural | 6.10.4 |
| HTTP Client | axios | 1.12.0 |
| Logging | bunyan | 1.8.15 |
| Error Tracking | @sentry/node | 10.8.0 |
| Stock Data | polygon.io | 2.1.2 |
| Image Generation | canvas | 3.2.0 |
| Task Scheduling | node-cron | 4.2.1 |
| Configuration | config | 4.1.1 |

## Project Statistics

| Metric | Count |
|--------|-------|
| TypeScript Source Files | 117 |
| Total Lines of Code | ~24,000 |
| Slash Commands | 51 |
| Message Response Types | 8 |
| Database Models | 21 |
| Event Handlers | 10 |
| Services | 4 |
| Test Files | 365+ |
| Test Coverage (Statements) | 88% |
| Test Coverage (Branches) | 69% |
| Test Coverage (Functions) | 90% |
| Total Dependencies | 62 |
| Dev Dependencies | 19 |

## Directory Structure Overview

```
alia-bot/
├── src/                    # Main application source
│   ├── commands/          # 51 slash commands
│   ├── responses/         # 8 message response handlers
│   ├── models/           # 21 Sequelize models
│   ├── services/         # 4 business logic services
│   ├── lib/              # Core libraries (Sentry, APIs)
│   ├── utils/            # 14+ utility modules
│   └── types/            # TypeScript definitions
├── events/               # 10 Discord event handlers
├── migrations/           # Database migrations
├── config/               # YAML configuration
├── scripts/              # Deployment scripts
├── .github/workflows/    # CI/CD pipelines
├── index.ts              # Entry point
└── docker-compose.yaml   # Development environment
```

## Build System

| Command | Purpose |
|---------|---------|
| `npm run build` | Compile TypeScript to dist/ |
| `npm start` | Run compiled bot |
| `npm run lint` | ESLint validation |
| `npm run test` | Jest test suite |
| `npm run coverage` | Coverage report |
| `npm run sequelize-cli` | Database migrations |

## Environment Requirements

### Required Environment Variables

| Variable | Purpose |
|----------|---------|
| `BOT_TOKEN` | Discord bot authentication |
| `NODE_ENV` | Environment (development/production/test) |
| `MYSQLDB_DATABASE` | Database name |
| `MYSQLDB_USER` | MySQL username |
| `MYSQLDB_PASSWORD` | MySQL password |
| `OPENAI_API_KEY` | OpenAI API integration |
| `POLYGON_API_KEY` | Stock market data |
| `SENTRY_DSN` | Error tracking |

### Optional Environment Variables

| Variable | Purpose |
|----------|---------|
| `DB_HOST` | Database host (default: localhost) |
| `APP_VERSION` | Application version |
| `COMMIT_SHA` | Git commit SHA |

## Supported Languages

- **TypeScript** - Primary development language
- **JavaScript** - Compiled output and configuration
- **YAML** - Configuration files
- **SQL** - Database migrations

## Key Features

1. **50+ Slash Commands** - Entertainment, utilities, gaming, information
2. **NLP Assistant** - OpenAI-powered responses with Bayesian classification
3. **Voice Features** - TTS with multiple voice options
4. **Economy System** - Sparks currency with transactions
5. **Gaming Integrations** - Arc Raiders, Dota 2, D&D
6. **External APIs** - Twitch, stock market, crypto
7. **Guild Management** - Polls, roll calls, verification
8. **Content Management** - Memories, louds, adlibs, memes
