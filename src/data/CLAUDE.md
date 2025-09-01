# Data - CLAUDE.md

## Purpose
This directory contains static data files used for machine learning, classification, and training purposes. These JSON files provide training datasets and configuration data for the bot's AI-powered features, particularly the assistant response system.

## Files Overview
- `classifiers.json` - Main training dataset for intent classification (current production version)
- `classifiers-cleaned.json` - Cleaned and processed version of training data with duplicates removed
- `classifiers-expanded.json` - Extended training dataset with additional examples and variations
- `classifiers-original.json` - Original baseline training data before expansions and modifications

## Data Structure & Format

### Training Data Schema
Each classifier file contains training examples in the format:
```json
{
  "general-knowledge": [
    "What is the capital of France?",
    "How does photosynthesis work?",
    "Explain quantum mechanics"
  ],
  "casual-conversation": [
    "Hello there",
    "How are you doing?",
    "Good morning everyone"
  ],
  "not-for-assistant": [
    "lol",
    "nice meme",
    "discord nitro when"
  ]
}
```

### Intent Categories
- **general-knowledge** - Questions and requests that benefit from AI assistance
- **casual-conversation** - Friendly greetings and social interactions  
- **not-for-assistant** - Messages that should not trigger AI responses (memes, reactions, etc.)

## File Evolution & Versions

### `classifiers-original.json` (Baseline)
- Initial training dataset with core examples
- ~100 examples across 3 categories
- Basic coverage of common query types

### `classifiers-expanded.json` (Enhanced)
- Extended dataset with more diverse examples
- ~800+ examples with variations and edge cases
- Improved coverage of technical topics and conversational patterns

### `classifiers-cleaned.json` (Optimized)
- Duplicate removal and data normalization
- Quality improvements and consistency fixes
- Optimized for faster training and better accuracy

### `classifiers.json` (Production)
- Current active training dataset used by the bot
- Balance between accuracy and performance
- Regularly updated based on real-world usage

## Usage in Bot Features

### Intent Classification
The assistant response system uses this training data to:
- Train a Bayesian classifier for message intent detection
- Determine if a message warrants an AI-powered response
- Filter out casual messages that don't need assistant replies

### Classification Flow
1. **Message Analysis** - Incoming message is analyzed against trained classifier
2. **Confidence Scoring** - Each intent category receives a confidence score
3. **Threshold Check** - Messages above 70% confidence trigger assistant responses
4. **Response Generation** - High-confidence "general-knowledge" messages get OpenAI responses

## Data Maintenance

### Adding New Training Examples
- Add examples to appropriate intent categories
- Ensure diverse phrasing and variations
- Test classifier accuracy after additions
- Update production `classifiers.json` when ready

### Quality Guidelines
- **Diverse Examples** - Include various ways to ask similar questions
- **Clear Intent** - Examples should clearly belong to their category
- **Real-world Data** - Based on actual user interactions where possible
- **Balanced Dataset** - Roughly equal representation across categories

## Dependencies
### Used By
- `src/utils/hybrid-classifier.ts` - Loads training data for classification
- `src/responses/assistant.ts` - Uses classifier to determine response triggers
- `src/utils/assistant.ts` - Intent detection for conversation management

### Data Processing
- Training data is loaded at bot startup for classifier initialization
- No runtime modification of data files (read-only during operation)
- Updates require bot restart to take effect

## Performance Considerations
- **File Size** - Larger datasets improve accuracy but increase memory usage
- **Load Time** - Training data is parsed once at startup, not per message
- **Classification Speed** - More training examples may slightly slow classification
- **Memory Usage** - All training data is kept in memory for fast access

## Testing & Validation
- **Accuracy Testing** - Validate classifier performance against test messages
- **False Positive/Negative Analysis** - Monitor misclassified messages
- **A/B Testing** - Compare different training datasets for optimal performance
- **Production Metrics** - Track assistant response appropriateness and user feedback