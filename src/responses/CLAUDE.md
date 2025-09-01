# Responses - CLAUDE.md

## Purpose
This directory contains automatic message response handlers that react to user messages without requiring slash commands. These responses run with priority-based processing where only one response type can trigger per message, preventing spam and ensuring appropriate bot behavior.

## Files Overview
- `index.ts` - Central coordinator that exports all response handlers for easy importing
- `adlibs.ts` - Mad-libs style text replacement using configurable templates from database
- `assistant.ts` - OpenAI-powered AI assistant responses with Bayesian intent classification
- `louds.ts` - Responds to all-caps messages with matching all-caps responses from database
- `triggers.ts` - Pattern-based responses using configurable trigger words and phrases

## Key Functions/Classes
- `Adlibs(message, context)` - Replaces placeholders like `{noun}` in template strings
- `Assistant(message, context)` - Uses Natural.js classifier + OpenAI for smart responses
- `Louds(message, context)` - Detects and responds to ALL CAPS messages
- `Triggers(message, context)` - Matches message content against configured trigger patterns

## Response Priority System
Responses are processed in priority order (implemented in `events/messageCreate.ts`):

1. **Assistant (Highest)** - OpenAI-powered responses for general knowledge questions
2. **Triggers (High)** - Custom pattern-based responses 
3. **Adlibs (Medium)** - Template-based text replacement
4. **Louds (Lowest)** - All-caps message responses

Only one response can trigger per message to prevent response conflicts.

## Response Processing Flow
1. **Intent Classification** - Assistant uses Bayesian classifier to determine if message needs AI response
2. **Pattern Matching** - Triggers checks for configured keyword/phrase matches
3. **Template Processing** - Adlibs looks for placeholder patterns to replace
4. **Case Detection** - Louds checks if message is predominantly uppercase

## Configuration Sources
- **Database Models** - Adlibs, Louds, and Triggers tables store configurable responses
- **Training Data** - Assistant uses hardcoded training data for intent classification
- **Confidence Thresholds** - Each system has minimum confidence requirements

## Dependencies
### External
- `openai` - GPT-powered assistant responses
- `natural` - Bayesian text classification for intent detection
- `discord.js` - Message objects and Discord API interaction

### Internal
- `../utils/types` - Context and type definitions
- `../utils/assistant` - Intent classification and conversation management
- `../utils/triggerCache` - Performance optimization for trigger matching
- `../models/*` - Database access for configurable responses

## Usage Patterns
Response handlers are called from `events/messageCreate.ts` in priority order:

```typescript
// Each handler returns boolean indicating if it responded
const assistantResult = await Assistant(message, context);
if (assistantResult) return; // Stop processing if assistant responded

const triggersResult = await Triggers(message, context);
if (triggersResult) return; // Stop processing if triggers responded

// Continue through remaining handlers...
```

## Performance Optimizations
- **Trigger Caching** - Frequently accessed triggers are cached for faster lookup
- **Intent Classification** - Pre-trained classifier avoids API calls for non-questions
- **Database Queries** - Optimized queries with proper indexing for fast pattern matching
- **Early Exit** - Processing stops after first successful response

## Testing
Comprehensive test coverage includes:
- **Unit Tests** - Individual response handler logic
- **Integration Tests** - Database interactions and external API calls
- **Performance Tests** - Trigger matching speed with large datasets
- **Mock Testing** - OpenAI API and Discord message simulation