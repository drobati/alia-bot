# /clip — Save Memorable Quotes from Chat

## Overview

A quote board for the server. Users right-click any message to clip it, then browse and recall clips via slash commands.

## Saving Clips

- **Context menu**: Right-click message → Apps → "Save Clip"
- Uses `ContextMenuCommandBuilder` with `ApplicationCommandType.Message` (first context menu command in the bot)
- Replies ephemerally: "Clipped! 📎" with a preview of the saved message
- Prevents duplicate clips of the same message (unique constraint on `guild_id` + `message_id`)
- Stores message content, author info, channel, timestamp, and who clipped it

## Browsing Clips

### `/clip random`
- Shows a random clip from the server
- Embed: message content in description, author mention, original timestamp, "Jump to message" link
- Footer: "Clipped by @username"

### `/clip list [user]`
- Paginated list of clips, newest first
- Optional `user` option filters to things that person said
- Shows clip ID, content preview (truncated), and author per entry

### `/clip delete <clip_id>`
- Removes a clip
- Allowed by: the person who clipped it, or the person who was quoted

## Data Model

### Clip

| Field | Type | Notes |
|-------|------|-------|
| id | INTEGER | Auto-increment primary key |
| guild_id | STRING | Server scope |
| channel_id | STRING | Original message channel |
| message_id | STRING | Original message ID |
| message_content | TEXT | Message text at time of clipping |
| message_author_id | STRING | Who said it |
| message_author_username | STRING | Display name at time of clipping |
| clipped_by_id | STRING | Who saved it |
| clipped_by_username | STRING | Display name at time of clipping |
| message_timestamp | DATE | When the original message was sent |
| created_at | DATE | Auto |
| updated_at | DATE | Auto |

**Indexes:**
- Unique on `(guild_id, message_id)` — no duplicate clips
- Index on `(guild_id, message_author_id)` — fast user filtering
- Index on `guild_id` — fast random/list queries

## Embed Format

```
┌──────────────────────────────────┐
│ 📎 Clip #42                      │
│                                  │
│ "I swear the bot is sentient"    │
│                                  │
│ — @SomeUser in #general          │
│ March 10, 2026                   │
│ [Jump to message]                │
│                                  │
│ Clipped by @Derek                │
└──────────────────────────────────┘
```

Color: `0xFFD700` (gold)

## Command Registration

Two commands registered with Discord:
1. **Context menu command**: "Save Clip" (`ApplicationCommandType.Message`)
2. **Slash command**: `/clip` with subcommands `random`, `list`, `delete`

Both can live in `src/commands/clip.ts` since they share the Clip model.

## Error Handling

- Clip already exists: ephemeral "This message is already clipped!"
- Empty message (image-only, embed-only): ephemeral "Can't clip messages without text content"
- Clip not found (delete/random on empty server): appropriate ephemeral message
- No permission to delete: ephemeral "You can only delete clips you saved or clips of your own messages"
