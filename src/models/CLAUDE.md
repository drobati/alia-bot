# Models - CLAUDE.md

## Purpose
This directory contains Sequelize database models that define the structure and relationships for persistent data storage. Each model represents a database table and provides an interface for CRUD operations, validations, and associations used throughout the bot's features.

## Files Overview
- `index.ts` - Central model registry that exports all models and handles initialization
- `adlibs.ts` - Mad-libs templates with placeholders and replacement text
- `config.ts` - Bot configuration settings (key-value pairs for various features)
- `louds.ts` - All-caps message responses stored in database
- `memories.ts` - Guild-specific memory storage (key-value pairs per guild)
- `memeTemplate.ts` - Meme template definitions with positioning and styling
- `motivationalConfig.ts` - Motivational quote system configuration
- `Poll.ts` - Poll definitions with questions, options, and settings
- `PollVote.ts` - Individual votes cast on polls (many-to-one with Poll)
- `rollcall.ts` - Member attendance and check-in tracking
- `twitch.ts` - Twitch stream notification configurations

## Key Model Structures

### Content Management Models
- **Adlibs** - `{ id, template, placeholders, createdBy, guildId }`
- **Louds** - `{ id, trigger, response, createdBy, guildId }`
- **Memories** - `{ id, key, value, guildId, userId, createdAt }`
- **MemeTemplate** - `{ id, name, imagePath, textBoxes, fontSettings }`

### Configuration Models
- **Config** - `{ key, value, description }` - Bot-wide settings and OpenAI threads
- **MotivationalConfig** - `{ guildId, channelId, enabled, frequency }`
- **Twitch** - `{ channelName, discordChannelId, guildId, enabled }`

### Interactive Feature Models
- **Poll** - `{ id, question, options, createdBy, guildId, expiresAt }`
- **PollVote** - `{ pollId, userId, optionIndex, createdAt }`
- **RollCall** - `{ id, userId, guildId, checkedIn, lastCheckIn }`

## Model Associations
- **Poll ↔ PollVote** - One-to-many relationship for vote tracking
- **Guild-based models** - Most models are scoped by `guildId` for multi-server support
- **User tracking** - Models track `createdBy` or `userId` for ownership/attribution

## Data Validation & Constraints
- **Required fields** - Essential data like `guildId`, `key`, `template` are non-nullable
- **Unique constraints** - Prevent duplicate keys in memories, config settings
- **Length limits** - Text fields have appropriate maximum lengths for Discord limits
- **Foreign key relationships** - Proper referential integrity between related models

## Common Usage Patterns

### Guild-Scoped Queries
```typescript
// Find guild-specific data
Memories.findAll({ where: { guildId: guild.id } })
Louds.findAll({ where: { guildId: guild.id } })
```

### Key-Value Storage
```typescript
// Config and memories use key-value pattern
Config.findOne({ where: { key: 'openai_thread_123' } })
Memories.create({ key: 'fact', value: 'data', guildId })
```

### User Attribution
```typescript
// Track who created content
Adlibs.create({ template, createdBy: user.id, guildId })
```

## Database Features
- **Auto-timestamps** - `createdAt` and `updatedAt` tracked automatically
- **Soft deletes** - Some models support soft deletion for audit trails
- **Indexing** - Optimized queries on frequently accessed fields (guildId, keys)
- **Migrations** - Schema changes managed through Sequelize migrations

## Dependencies
### External
- `sequelize` - ORM for database operations and model definitions
- `mysql2` - MySQL database driver for production deployment

### Internal
- Models are imported by commands, responses, and services for data persistence
- `src/utils/types` - Type definitions that align with model structures

## Usage in Commands
Models are accessible through the Context object:
```typescript
async execute(interaction, context) {
    const { tables } = context;
    const memories = await tables.Memories.findAll({ 
        where: { guildId: interaction.guild.id } 
    });
}
```

## Testing
Database operations are mocked in tests:
- **Model validation** - Required fields and constraints
- **Association testing** - Relationship integrity  
- **Query optimization** - Index usage and performance
- **Migration testing** - Schema change validation