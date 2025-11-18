# AI Integration Tests

This directory contains integration tests for the AI assistant functionality in Alia-bot.

## Overview

Unlike unit tests which mock external dependencies, **integration tests make real API calls** to OpenAI to verify that the AI assistant works correctly end-to-end.

## Test Files

### 1. `assistant.integration.test.ts`
Tests the OpenAI response generation utility (`src/utils/assistant.ts`).

**What it tests:**
- Real OpenAI API calls with various question types
- Response quality and constraints (Discord message limits)
- Error handling with actual API
- Token usage and performance metrics
- Configuration validation (model, temperature, max_tokens)

**Example test cases:**
- Simple general knowledge questions ("What is photosynthesis?")
- Factual questions ("What is the capital of France?")
- Technical concepts ("Explain recursion in programming")
- Response length constraints (under 2000 characters)
- Performance timing (under 30 seconds)

### 2. `hybrid-classifier.integration.test.ts`
Tests the hybrid classifier (`src/utils/hybrid-classifier.ts`) with real training data.

**What it tests:**
- Classification accuracy across different message types
- Confidence threshold validation
- Keyword vs Bayesian classification methods
- Edge cases (short messages, gibberish, mixed content)
- Real-world Discord message patterns

**Example test cases:**
- General knowledge questions → `general-knowledge` intent
- Technical programming questions → `technical-question` intent
- Greetings → `small-talk` intent
- Current events → `real-time-knowledge` intent
- Personal projects → `business-discussion` intent

### 3. `src/responses/assistant.integration.test.ts`
Tests the full assistant response system end-to-end (`src/responses/assistant.ts`).

**What it tests:**
- Complete message processing pipeline:
  1. Direct addressing filter (bot mentions, "Alia," prefix)
  2. Content appropriateness checking
  3. Hybrid classification
  4. OpenAI API integration
  5. Discord message sending
- Message filtering (bot messages, non-addressed messages)
- Content filtering (inappropriate, personal requests)
- Real OpenAI responses with proper context
- Full logging pipeline

**Example test cases:**
- "Alia, what is photosynthesis?" → generates and sends real response
- "Today is a beautiful day" → skipped (not addressed to bot)
- "Alia, you are stupid" → filtered (inappropriate content)
- Multiple question types (what, how, why, where)

## Prerequisites

### Environment Variables
Integration tests require a valid OpenAI API key:

```bash
export OPENAI_API_KEY=sk-your-actual-api-key-here
```

**Important:** Tests will automatically skip if:
- `OPENAI_API_KEY` is not set
- `OPENAI_API_KEY` is set to the CI placeholder: `test-key-for-ci`

### Dependencies
Ensure all npm dependencies are installed:

```bash
npm install
```

## Running Integration Tests

### Run all integration tests:
```bash
npm run test:integration
```

### Run a specific integration test file:
```bash
NODE_ENV=test jest assistant.integration.test.ts
NODE_ENV=test jest hybrid-classifier.integration.test.ts
```

### Run integration tests in watch mode:
```bash
NODE_ENV=test jest --watch --testPathPatterns=integration.test.ts
```

## Running Unit Tests (without API calls)

Unit tests mock all external dependencies and don't require API keys:

```bash
npm run test:unit
```

## Test Organization

```
src/
├── utils/
│   ├── assistant.ts                          # OpenAI response generator
│   ├── assistant.test.ts                     # Unit tests (mocked)
│   ├── assistant.integration.test.ts         # Integration tests (real API)
│   ├── hybrid-classifier.ts                  # Message classifier
│   ├── hybrid-classifier.test.ts             # Unit tests (mocked)
│   └── hybrid-classifier.integration.test.ts # Integration tests (real data)
└── responses/
    ├── assistant.ts                          # Full assistant response handler
    ├── assistant.test.ts                     # Unit tests (mocked)
    └── assistant.integration.test.ts         # Integration tests (real API)
```

## Test Characteristics

### Integration Tests
- ✅ Make real OpenAI API calls
- ✅ Use actual training data
- ✅ Test end-to-end flows
- ✅ Validate response quality
- ✅ Measure real performance
- ⚠️ Require API key
- ⚠️ Slower (30s timeout per test)
- ⚠️ Cost money (OpenAI API usage)

### Unit Tests
- ✅ Mock all external calls
- ✅ Fast execution
- ✅ No API costs
- ✅ Run in CI/CD
- ⚠️ Don't verify actual integration

## CI/CD Considerations

Integration tests are designed to:
1. **Skip automatically** in CI environments without API keys
2. **Run in band** (`--runInBand`) to avoid parallel API call limits
3. **Use longer timeouts** (30 seconds) to account for API latency
4. **Log detailed metrics** for debugging and monitoring

## Cost Awareness

Integration tests make real OpenAI API calls. Each test run costs approximately:

- **Per test:** ~$0.001 - $0.01 (depending on model and response length)
- **Full suite:** ~$0.10 - $0.50 for all integration tests

**Recommendations:**
- Run integration tests before major releases
- Run during development when verifying AI behavior changes
- Use unit tests for rapid iteration
- Monitor OpenAI usage dashboard

## Debugging Failed Tests

### If a test fails:

1. **Check logs** - Integration tests log detailed information:
   ```typescript
   expect(mockContext.log.info).toHaveBeenCalledWith(
       'OpenAI API response received',
       expect.objectContaining({ success: true })
   );
   ```

2. **Verify API key** - Ensure it's valid and has quota:
   ```bash
   echo $OPENAI_API_KEY
   ```

3. **Check OpenAI status** - Visit https://status.openai.com

4. **Review response content** - Tests validate response relevance:
   ```typescript
   expect(response.toLowerCase()).toContain('paris');
   ```

5. **Check timeouts** - API calls should complete within 30 seconds

## Example Output

Successful integration test run:
```
 PASS  src/utils/assistant.integration.test.ts (45.234 s)
  OpenAI Assistant Integration Tests
    Basic Response Generation
      ✓ should generate a response for a simple general knowledge question (3245 ms)
      ✓ should generate a response for a factual question (2891 ms)
      ✓ should generate a response for a technical concept (3567 ms)
    Response Quality and Constraints
      ✓ should keep responses under Discord message limit (4123 ms)
      ✓ should provide concise responses as per system prompt (2734 ms)
```

Skipped tests (no API key):
```
 SKIP  src/utils/assistant.integration.test.ts
  OpenAI Assistant Integration Tests
    ○ skipped 25 tests
```

## Maintenance

When adding new AI features:

1. **Add unit tests** for isolated component testing
2. **Add integration tests** for end-to-end validation
3. **Update this documentation** with new test categories
4. **Verify API costs** for new test scenarios

## Related Documentation

- [CLAUDE.md](../../CLAUDE.md) - Project overview and guidelines
- [src/responses/CLAUDE.md](../responses/CLAUDE.md) - Response handlers documentation
- [src/utils/CLAUDE.md](./CLAUDE.md) - Utility functions documentation
