# Utils - CLAUDE.md

## Purpose
This directory contains utility functions, helper classes, and shared functionality used throughout the bot. These utilities provide reusable components for common operations like logging, Discord API interactions, permissions, content generation, and performance optimization.

## Files Overview
- `types.ts` - TypeScript type definitions and interfaces (Context, BotEvent, etc.)
- `constants.ts` - Application constants and configuration values
- `logger.ts` - Bunyan logger with Sentry integration and structured logging
- `permissions.ts` - Permission checking utilities (owner validation)
- `discordHelpers.ts` - Discord API interaction helpers and safety wrappers
- `assistant.ts` - OpenAI integration and conversation management
- `hybrid-classifier.ts` - Bayesian + keyword hybrid text classification
- `memeGenerator.ts` - Canvas-based meme generation with text overlays
- `motivationalGenerator.ts` - Random motivational quote generation
- `triggerCache.ts` - Performance optimization for trigger word matching
- `testHelpers.ts` - Common testing utilities and mock functions

## Key Functions/Classes

### Core Infrastructure
- `BotLogger` class - Enhanced logging with command/event/API tracking
- `Context` interface - Shared state container for database, logger, services
- `checkOwnerPermission()` - Validates bot owner access for restricted commands

### Discord Helpers
- `safelyFindChannel()` - Safe channel lookup with error handling
- `safelySendToChannel()` - Reliable message sending with fallbacks
- `isTextChannel()` - Type guard for text channel validation

### Content Generation
- `MemeGenerator` class - Creates memes with canvas rendering and text positioning
- `MotivationalGenerator` class - Generates inspirational quotes with templates
- `AssistantManager` class - Manages OpenAI conversations with thread persistence

### Performance & Classification
- `HybridClassifier` class - Combines Bayesian classification with keyword matching
- `TriggerCache` class - LRU cache for frequently accessed trigger patterns
- Training data management for intent classification

### Configuration
- `TTS_CONFIG` - Text-to-speech settings and limits
- `MEME_CONFIG` - Meme generation parameters and fonts
- `ASSISTANT_CONFIG` - OpenAI integration settings

## Utility Categories

### **Type Safety**
- `types.ts` - Comprehensive TypeScript definitions for all bot components

### **Logging & Monitoring**  
- `logger.ts` - Structured logging with Sentry error tracking and categorization

### **Security & Permissions**
- `permissions.ts` - Owner validation and access control

### **Discord Integration**
- `discordHelpers.ts` - Safe API wrappers and channel management

### **AI & NLP**
- `assistant.ts`, `hybrid-classifier.ts` - Text processing and AI responses

### **Content Creation**
- `memeGenerator.ts`, `motivationalGenerator.ts` - Dynamic content generation

### **Performance Optimization**
- `triggerCache.ts` - Caching strategies for high-frequency operations

### **Testing Support**
- `testHelpers.ts` - Mock utilities and test data generators

## Dependencies
### External
- `bunyan` - Structured logging framework
- `@sentry/node` - Error tracking and performance monitoring
- `openai` - GPT API integration
- `natural` - Bayesian text classification
- `canvas` - Server-side image generation
- `discord.js` - Discord API types and utilities
- `config` - Configuration management

### Internal
- Utilities are widely imported by commands, responses, services, and event handlers
- Cross-dependencies between logger, types, and helper functions

## Usage Patterns
Utilities are imported throughout the application:

```typescript
import { Context, BotLogger } from '../utils/types';
import { checkOwnerPermission } from '../utils/permissions';
import { safelyFindChannel } from '../utils/discordHelpers';
```

Common patterns:
- **Context Passing** - Context object provides shared state across all handlers
- **Safe Operations** - Helper functions include error handling and fallbacks  
- **Performance Caching** - Frequently accessed data is cached for speed
- **Structured Logging** - All operations use categorized logging for debugging

## Testing
Each utility has comprehensive test coverage:
- **Unit Tests** - Individual function logic and edge cases
- **Integration Tests** - External API interactions (Sentry, OpenAI)
- **Performance Tests** - Cache efficiency and trigger matching speed
- **Mock Testing** - Discord API and external service simulation