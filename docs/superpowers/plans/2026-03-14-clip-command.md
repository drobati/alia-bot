# /clip Command Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a quote board feature — right-click any message to clip it, browse clips with slash commands.

**Architecture:** Context menu command ("Save Clip") saves message data to a Clip model. Slash command `/clip` with subcommands `random`, `list`, `delete` for browsing. The interaction handler needs updating to dispatch context menu interactions.

**Tech Stack:** discord.js (ContextMenuCommandBuilder, ApplicationCommandType.Message), Sequelize model, existing bot patterns.

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `src/models/clip.ts` | Create | Clip database model |
| `src/types/database.ts` | Modify | Add ClipAttributes, ClipModel, ClipModelStatic, update DatabaseTables |
| `src/models/index.ts` | Modify | Register Clip model |
| `src/commands/clip.ts` | Create | Context menu handler + slash command subcommands |
| `src/commands/clip.test.ts` | Create | Tests for all clip functionality |
| `events/interactionCreate.ts` | Modify | Add context menu command dispatch |
| `migrations/20260314000000-create-clips-table.js` | Create | Database migration |

---

## Chunk 1: Database Layer

### Task 1: Create Clip model

**Files:**
- Create: `src/models/clip.ts`
- Modify: `src/types/database.ts` (after line 525)
- Modify: `src/models/index.ts`

- [ ] **Step 1: Add type definitions to `src/types/database.ts`**

Add after the `StockTrackingModelStatic` interface (after line 525):

```typescript
export interface ClipAttributes {
    id?: number;
    guild_id: string;
    channel_id: string;
    message_id: string;
    message_content: string;
    message_author_id: string;
    message_author_username: string;
    clipped_by_id: string;
    clipped_by_username: string;
    message_timestamp: Date;
    created_at?: Date;
    updated_at?: Date;
}

export interface ClipModel extends ClipAttributes {
    update(_values: Partial<ClipAttributes>): Promise<ClipModel>;
    destroy(): Promise<void>;
}

export interface ClipModelStatic {
    findAll(options?: FindOptions<ClipAttributes>): Promise<ClipModel[]>;
    findOne(options?: FindOptions<ClipAttributes>): Promise<ClipModel | null>;
    create(values: ClipAttributes): Promise<ClipModel>;
    findOrCreate(options: FindOrCreateOptions<ClipAttributes>): Promise<[ClipModel, boolean]>;
    destroy(options: DestroyOptions<ClipAttributes>): Promise<number>;
    count(options?: FindOptions<ClipAttributes>): Promise<number>;
}
```

Add `Clip: ClipModelStatic;` to the `DatabaseTables` interface (before the `[key: string]: any` line).

- [ ] **Step 2: Create `src/models/clip.ts`**

```typescript
import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    Clip: sequelize.define('Clip', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        channel_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        message_author_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_author_username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        clipped_by_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        clipped_by_username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'clips',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['guild_id', 'message_id'],
                name: 'clips_guild_message_unique',
            },
            {
                fields: ['guild_id', 'message_author_id'],
                name: 'clips_guild_author',
            },
            {
                fields: ['guild_id'],
                name: 'clips_guild',
            },
        ],
    }),
});
```

- [ ] **Step 3: Register model in `src/models/index.ts`**

Add import: `import Clip from "./clip";`
Add to export object: `Clip,`

- [ ] **Step 4: Create migration `migrations/20260314000000-create-clips-table.js`**

```javascript
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('clips', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            channel_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            message_author_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_author_username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            clipped_by_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            clipped_by_username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_timestamp: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('NOW'),
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('NOW'),
            },
        });

        await queryInterface.addIndex('clips', ['guild_id', 'message_id'], {
            unique: true,
            name: 'clips_guild_message_unique',
        });
        await queryInterface.addIndex('clips', ['guild_id', 'message_author_id'], {
            name: 'clips_guild_author',
        });
        await queryInterface.addIndex('clips', ['guild_id'], {
            name: 'clips_guild',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('clips');
    },
};
```

- [ ] **Step 5: Commit**

```bash
git add src/models/clip.ts src/models/index.ts src/types/database.ts migrations/20260314000000-create-clips-table.js
git commit -m "feat(clip): add Clip database model and migration"
```

---

## Chunk 2: Context Menu + Interaction Handler

### Task 2: Update interaction handler for context menu commands

**Files:**
- Modify: `events/interactionCreate.ts`
- Modify: `src/types/discord.ts`

- [ ] **Step 1: Update `src/types/discord.ts` to support context menu commands**

Add `ContextMenuCommandBuilder` and `MessageContextMenuCommandInteraction` to the discord.js import.

Add a new interface:

```typescript
export interface BotContextMenuCommand {
    data: ContextMenuCommandBuilder;
    execute(interaction: MessageContextMenuCommandInteraction, context: Context): Promise<void>;
}
```

Update `ExtendedClient`:

```typescript
export interface ExtendedClient extends Client {
    commands: Collection<string, BotCommand | BotContextMenuCommand>;
}
```

- [ ] **Step 2: Update `events/interactionCreate.ts` to dispatch context menu interactions**

Add `MessageContextMenuCommandInteraction` to the discord.js import on line 1.

Replace the guard on line 24:

```typescript
if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
```

With:

```typescript
// Handle message context menu commands (e.g., "Save Clip")
if (interaction.isMessageContextMenuCommand()) {
    const command = (interaction.client as ExtendedClient).commands
        .get(interaction.commandName) as any;

    if (!command) {
        log.error(`No context menu command matching ${interaction.commandName} was found.`);
        return;
    }

    try {
        log.info(`Executing context menu command: ${interaction.commandName}`);
        await command.execute(interaction, context);
    } catch (error) {
        log.error(error);
        Sentry.captureException(error, {
            tags: { handler: 'interactionCreate', command: interaction.commandName },
            extra: { userId: interaction.user?.id, guildId: interaction.guildId },
        });
        if (interaction.replied || interaction.deferred) {
            await interaction.followUp({ content: 'There was an error while executing this command!', ephemeral: true });
        } else {
            await interaction.reply({ content: 'There was an error while executing this command!', ephemeral: true });
        }
    }
    return;
}

if (!interaction.isChatInputCommand() && !interaction.isAutocomplete()) {
```

- [ ] **Step 3: Commit**

```bash
git add events/interactionCreate.ts src/types/discord.ts
git commit -m "feat(clip): add context menu command support to interaction handler"
```

### Task 3: Create the clip command

**Files:**
- Create: `src/commands/clip.ts`

- [ ] **Step 1: Create `src/commands/clip.ts`**

```typescript
import {
    SlashCommandBuilder,
    ContextMenuCommandBuilder,
    ApplicationCommandType,
    CommandInteraction,
    MessageContextMenuCommandInteraction,
    EmbedBuilder,
} from 'discord.js';
import { Context } from '../utils/types';

const CLIPS_PER_PAGE = 10;
const EMBED_COLOR = 0xFFD700; // Gold

// Context menu command: right-click → Apps → "Save Clip"
export const contextMenu = {
    data: new ContextMenuCommandBuilder()
        .setName('Save Clip')
        .setType(ApplicationCommandType.Message),

    async execute(interaction: MessageContextMenuCommandInteraction, context: Context) {
        const message = interaction.targetMessage;

        if (!message.content || message.content.trim().length === 0) {
            await interaction.reply({ content: "Can't clip messages without text content.", ephemeral: true });
            return;
        }

        if (!interaction.guildId) {
            await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
            return;
        }

        try {
            const [clip, created] = await context.tables.Clip.findOrCreate({
                where: { guild_id: interaction.guildId, message_id: message.id },
                defaults: {
                    guild_id: interaction.guildId,
                    channel_id: message.channelId,
                    message_id: message.id,
                    message_content: message.content,
                    message_author_id: message.author.id,
                    message_author_username: message.author.displayName || message.author.username,
                    clipped_by_id: interaction.user.id,
                    clipped_by_username: interaction.user.displayName || interaction.user.username,
                    message_timestamp: message.createdAt,
                },
            });

            if (!created) {
                await interaction.reply({ content: 'This message is already clipped!', ephemeral: true });
                return;
            }

            const preview = message.content.length > 100
                ? message.content.substring(0, 100) + '...'
                : message.content;

            await interaction.reply({
                content: `Clipped! 📎\n> ${preview}`,
                ephemeral: true,
            });

            context.log.info({
                category: 'clip',
                clipId: clip.id,
                guildId: interaction.guildId,
                clippedBy: interaction.user.id,
            }, 'Message clipped');
        } catch (error) {
            context.log.error({ error, category: 'clip' }, 'Failed to save clip');
            await interaction.reply({ content: 'Failed to save clip. Try again later.', ephemeral: true });
        }
    },
};

// Slash command: /clip random | list | delete
export default {
    data: new SlashCommandBuilder()
        .setName('clip')
        .setDescription('Browse saved clips from this server')
        .addSubcommand(sub =>
            sub.setName('random')
                .setDescription('Show a random clip'),
        )
        .addSubcommand(sub =>
            sub.setName('list')
                .setDescription('List saved clips')
                .addUserOption(opt =>
                    opt.setName('user')
                        .setDescription('Filter clips by who said it')
                        .setRequired(false),
                )
                .addIntegerOption(opt =>
                    opt.setName('page')
                        .setDescription('Page number')
                        .setMinValue(1)
                        .setRequired(false),
                ),
        )
        .addSubcommand(sub =>
            sub.setName('delete')
                .setDescription('Delete a clip')
                .addIntegerOption(opt =>
                    opt.setName('id')
                        .setDescription('Clip ID to delete')
                        .setRequired(true),
                ),
        ),

    async execute(interaction: CommandInteraction, context: Context) {
        if (!interaction.isChatInputCommand()) {return;}

        const subcommand = interaction.options.getSubcommand();

        switch (subcommand) {
        case 'random':
            await handleRandom(interaction, context);
            break;
        case 'list':
            await handleList(interaction, context);
            break;
        case 'delete':
            await handleDelete(interaction, context);
            break;
        }
    },
};

function buildClipEmbed(clip: any): EmbedBuilder {
    const messageUrl = `https://discord.com/channels/${clip.guild_id}/${clip.channel_id}/${clip.message_id}`;

    return new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(`📎 Clip #${clip.id}`)
        .setDescription(`"${clip.message_content}"\n\n— <@${clip.message_author_id}> in <#${clip.channel_id}>\n[Jump to message](${messageUrl})`)
        .setTimestamp(new Date(clip.message_timestamp))
        .setFooter({ text: `Clipped by ${clip.clipped_by_username}` });
}

async function handleRandom(interaction: CommandInteraction, context: Context) {
    if (!interaction.guildId) {
        await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
        return;
    }

    const count = await context.tables.Clip.count({ where: { guild_id: interaction.guildId } });

    if (count === 0) {
        await interaction.reply({ content: 'No clips saved yet! Right-click a message → Apps → Save Clip to get started.', ephemeral: true });
        return;
    }

    const randomOffset = Math.floor(Math.random() * count);
    const clips = await context.tables.Clip.findAll({
        where: { guild_id: interaction.guildId },
        limit: 1,
        offset: randomOffset,
    });

    if (clips.length === 0) {
        await interaction.reply({ content: 'No clips found.', ephemeral: true });
        return;
    }

    await interaction.reply({ embeds: [buildClipEmbed(clips[0])] });
}

async function handleList(interaction: CommandInteraction, context: Context) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) {
        await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
        return;
    }

    const user = interaction.options.getUser('user');
    const page = (interaction.options.getInteger('page') || 1) - 1;

    const where: any = { guild_id: interaction.guildId };
    if (user) {
        where.message_author_id = user.id;
    }

    const total = await context.tables.Clip.count({ where });

    if (total === 0) {
        const msg = user
            ? `No clips found for ${user.displayName || user.username}.`
            : 'No clips saved yet! Right-click a message → Apps → Save Clip to get started.';
        await interaction.reply({ content: msg, ephemeral: true });
        return;
    }

    const totalPages = Math.ceil(total / CLIPS_PER_PAGE);
    const safePage = Math.min(page, totalPages - 1);

    const clips = await context.tables.Clip.findAll({
        where,
        order: [['created_at', 'DESC']],
        limit: CLIPS_PER_PAGE,
        offset: safePage * CLIPS_PER_PAGE,
    });

    const lines = clips.map(clip => {
        const preview = clip.message_content.length > 80
            ? clip.message_content.substring(0, 80) + '...'
            : clip.message_content;
        return `**#${clip.id}** "${preview}" — <@${clip.message_author_id}>`;
    });

    const title = user
        ? `📎 Clips by ${user.displayName || user.username}`
        : '📎 Server Clips';

    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(title)
        .setDescription(lines.join('\n'))
        .setFooter({ text: `Page ${safePage + 1}/${totalPages} · ${total} clips total` });

    await interaction.reply({ embeds: [embed] });
}

async function handleDelete(interaction: CommandInteraction, context: Context) {
    if (!interaction.isChatInputCommand() || !interaction.guildId) {
        await interaction.reply({ content: 'Clips only work in servers.', ephemeral: true });
        return;
    }

    const clipId = interaction.options.getInteger('id', true);

    const clip = await context.tables.Clip.findOne({
        where: { id: clipId, guild_id: interaction.guildId },
    });

    if (!clip) {
        await interaction.reply({ content: `Clip #${clipId} not found.`, ephemeral: true });
        return;
    }

    // Only the clipper or the quoted person can delete
    const userId = interaction.user.id;
    if (clip.clipped_by_id !== userId && clip.message_author_id !== userId) {
        await interaction.reply({
            content: 'You can only delete clips you saved or clips of your own messages.',
            ephemeral: true,
        });
        return;
    }

    await clip.destroy();

    await interaction.reply({ content: `Clip #${clipId} deleted.`, ephemeral: true });

    context.log.info({
        category: 'clip',
        clipId,
        deletedBy: userId,
        guildId: interaction.guildId,
    }, 'Clip deleted');
}
```

- [ ] **Step 2: Register the context menu command in `index.ts`**

Find where commands are loaded (the `handleCommandFile` function). After commands are loaded from `src/commands`, add the context menu command. Find the `loadFiles` call for commands and add after it:

```typescript
// Load context menu commands
try {
    const clipModule = await import('./src/commands/clip');
    if (clipModule.contextMenu) {
        client.commands.set(clipModule.contextMenu.data.name, clipModule.contextMenu);
        log.info(`Successfully loaded context menu command: ${clipModule.contextMenu.data.name}`);
    }
} catch (error) {
    log.error({ error }, 'Failed to load clip context menu command');
}
```

Also update `scripts/discord-commands/deploy.ts` to include context menu commands. After the existing command-loading loop (after line 38), add:

```typescript
// Load context menu commands
try {
    const clipModule = require(join(commandsPath, 'clip.js'));
    if (clipModule.contextMenu) {
        commands.push(clipModule.contextMenu.data.toJSON());
    }
} catch (error) {
    console.error('[ERROR] Failed to load clip context menu command:', error);
}
```

- [ ] **Step 3: Commit**

```bash
git add src/commands/clip.ts index.ts scripts/discord-commands/deploy.ts
git commit -m "feat(clip): add Save Clip context menu and /clip slash commands"
```

---

## Chunk 3: Tests

### Task 4: Write tests for the clip command

**Files:**
- Create: `src/commands/clip.test.ts`

- [ ] **Step 1: Create `src/commands/clip.test.ts`**

```typescript
import clipCommand, { contextMenu } from './clip';

// Mock context factory
function createMockContext() {
    return {
        log: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        tables: {
            Clip: {
                findOrCreate: jest.fn(),
                findAll: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                count: jest.fn().mockResolvedValue(0),
                destroy: jest.fn().mockResolvedValue(1),
            },
        },
    } as any;
}

function createMockContextMenuInteraction(overrides: any = {}) {
    return {
        guildId: 'guild1',
        user: { id: 'clipper1', displayName: 'Clipper', username: 'clipper' },
        targetMessage: {
            id: 'msg1',
            channelId: 'ch1',
            content: 'This is a hilarious message',
            author: { id: 'author1', displayName: 'Author', username: 'author' },
            createdAt: new Date('2026-03-14T12:00:00Z'),
        },
        reply: jest.fn(),
        ...overrides,
    } as any;
}

function createMockSlashInteraction(subcommand: string, options: any = {}) {
    return {
        guildId: 'guild1',
        user: { id: 'user1', displayName: 'User', username: 'user' },
        isChatInputCommand: () => true,
        options: {
            getSubcommand: () => subcommand,
            getUser: (name: string) => options[name] || null,
            getInteger: (name: string, _required?: boolean) => options[name] ?? null,
        },
        reply: jest.fn(),
        replied: false,
        deferred: false,
        ...options.interactionOverrides,
    } as any;
}

describe('clip command', () => {
    describe('command data', () => {
        it('should have correct command name', () => {
            expect(clipCommand.data.name).toBe('clip');
        });

        it('should have three subcommands', () => {
            const json = clipCommand.data.toJSON();
            expect(json.options).toHaveLength(3);
            const names = json.options!.map((o: any) => o.name);
            expect(names).toEqual(['random', 'list', 'delete']);
        });
    });

    describe('context menu data', () => {
        it('should have correct name', () => {
            expect(contextMenu.data.name).toBe('Save Clip');
        });
    });

    describe('Save Clip (context menu)', () => {
        it('should save a clip successfully', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction();
            const mockClip = { id: 1 };

            context.tables.Clip.findOrCreate.mockResolvedValue([mockClip, true]);

            await contextMenu.execute(interaction, context);

            expect(context.tables.Clip.findOrCreate).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: { guild_id: 'guild1', message_id: 'msg1' },
                }),
            );
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Clipped!') }),
            );
        });

        it('should reject duplicate clips', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction();

            context.tables.Clip.findOrCreate.mockResolvedValue([{}, false]);

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'This message is already clipped!' }),
            );
        });

        it('should reject empty messages', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction({
                targetMessage: { ...createMockContextMenuInteraction().targetMessage, content: '' },
            });

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining("Can't clip") }),
            );
        });

        it('should reject DM usage', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction({ guildId: null });

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Clips only work in servers.' }),
            );
        });

        it('should handle database errors', async () => {
            const context = createMockContext();
            const interaction = createMockContextMenuInteraction();

            context.tables.Clip.findOrCreate.mockRejectedValue(new Error('DB error'));

            await contextMenu.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('Failed to save clip') }),
            );
        });
    });

    describe('/clip random', () => {
        it('should return a random clip', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('random');

            context.tables.Clip.count.mockResolvedValue(5);
            context.tables.Clip.findAll.mockResolvedValue([{
                id: 3,
                guild_id: 'guild1',
                channel_id: 'ch1',
                message_id: 'msg3',
                message_content: 'Something funny',
                message_author_id: 'author1',
                clipped_by_username: 'Clipper',
                message_timestamp: new Date(),
            }]);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should handle empty clip board', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('random');

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No clips saved yet') }),
            );
        });
    });

    describe('/clip list', () => {
        it('should list clips', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('list');

            context.tables.Clip.count.mockResolvedValue(1);
            context.tables.Clip.findAll.mockResolvedValue([{
                id: 1,
                message_content: 'Funny quote',
                message_author_id: 'author1',
                created_at: new Date(),
            }]);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should filter by user', async () => {
            const context = createMockContext();
            const mockUser = { id: 'author1', displayName: 'Author', username: 'author' };
            const interaction = createMockSlashInteraction('list', { user: mockUser });

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(context.tables.Clip.count).toHaveBeenCalledWith(
                expect.objectContaining({
                    where: expect.objectContaining({ message_author_id: 'author1' }),
                }),
            );
        });

        it('should handle empty results', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('list');

            context.tables.Clip.count.mockResolvedValue(0);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('No clips saved yet') }),
            );
        });
    });

    describe('/clip delete', () => {
        it('should delete clip when requested by clipper', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 1 });

            const mockClip = {
                id: 1,
                clipped_by_id: 'user1',
                message_author_id: 'author1',
                destroy: jest.fn(),
            };
            context.tables.Clip.findOne.mockResolvedValue(mockClip);

            await clipCommand.execute(interaction, context);

            expect(mockClip.destroy).toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Clip #1 deleted.' }),
            );
        });

        it('should delete clip when requested by quoted person', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 1 });

            const mockClip = {
                id: 1,
                clipped_by_id: 'someone_else',
                message_author_id: 'user1', // interaction.user.id matches
                destroy: jest.fn(),
            };
            context.tables.Clip.findOne.mockResolvedValue(mockClip);

            await clipCommand.execute(interaction, context);

            expect(mockClip.destroy).toHaveBeenCalled();
        });

        it('should reject unauthorized delete', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 1 });

            const mockClip = {
                id: 1,
                clipped_by_id: 'other1',
                message_author_id: 'other2',
                destroy: jest.fn(),
            };
            context.tables.Clip.findOne.mockResolvedValue(mockClip);

            await clipCommand.execute(interaction, context);

            expect(mockClip.destroy).not.toHaveBeenCalled();
            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: expect.stringContaining('can only delete') }),
            );
        });

        it('should handle clip not found', async () => {
            const context = createMockContext();
            const interaction = createMockSlashInteraction('delete', { id: 999 });

            context.tables.Clip.findOne.mockResolvedValue(null);

            await clipCommand.execute(interaction, context);

            expect(interaction.reply).toHaveBeenCalledWith(
                expect.objectContaining({ content: 'Clip #999 not found.' }),
            );
        });
    });
});
```

- [ ] **Step 2: Run tests to verify they pass**

Run: `npx jest src/commands/clip.test.ts --no-coverage`
Expected: All tests pass

- [ ] **Step 3: Run full test suite to verify no regressions**

Run: `npx jest --no-coverage`
Expected: All tests pass, no regressions

- [ ] **Step 4: Commit**

```bash
git add src/commands/clip.test.ts
git commit -m "test(clip): add comprehensive tests for clip command"
```

---

## Chunk 4: Final Verification

### Task 5: Verify and push

- [ ] **Step 1: Run full test suite with coverage**

Run: `npx jest`
Expected: All tests pass, coverage thresholds met

- [ ] **Step 2: Run linter**

Run: `npx eslint src/commands/clip.ts src/commands/clip.test.ts src/models/clip.ts events/interactionCreate.ts`
Expected: No errors

- [ ] **Step 3: Commit any lint fixes, push, and create PR**

```bash
git push
```
