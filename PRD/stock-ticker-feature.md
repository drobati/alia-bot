# Product Requirements Document: Stock Ticker Feature

## Overview

Add stock ticker functionality to Alia-bot enabling Discord users to query stock prices and set up automated tracking with notifications based on time intervals or price movements.

## Feature Scope

### Phase 1: Basic Stock Price Lookup
**Goal:** Allow users to query current stock prices via slash command

**Requirements:**
- `/stock get <ticker>` command to retrieve current stock price
- Support for major US stock exchanges (NYSE, NASDAQ)
- Display: current price, daily change ($ and %), market status
- Error handling for invalid tickers
- Rate limiting protection for API calls

**Acceptance Criteria:**
- User can successfully query valid stock tickers (e.g., AAPL, TSLA, MSFT)
- Command returns formatted embed with price data
- Invalid tickers show helpful error messages
- Command respects Discord rate limits and API quotas

### Phase 2: Stock Tracking Setup
**Goal:** Enable users to track specific stocks with automated notifications

**Requirements:**
- `/stock track <ticker> [options]` command to set up tracking
- User can specify notification triggers:
  - Time-based: hourly, daily, weekly intervals
  - Price-based: percentage threshold (±5%, ±10%, etc.)
  - Price target: notify when stock hits specific price
- **Channel-specific notifications:** Notifications sent to the channel where the `/stock track` command was executed
- Database storage for tracking configurations (including channel ID)
- User can view their active tracking list
- User can remove/modify existing tracking

**Acceptance Criteria:**
- Users can successfully set up multiple stock tracking configurations
- Database stores user ID, ticker, trigger type, parameters, and **channel ID**
- `/stock list` shows user's active tracking setups with channel information
- `/stock untrack <ticker>` removes tracking
- **Notifications are delivered to the specific channel where tracking was set up**

### Phase 3: Automated Notifications
**Goal:** Deliver notifications based on configured triggers

**Requirements:**
- Background job system to check tracked stocks
- **Channel-specific notification delivery:** Messages sent to the channel where tracking was originally set up
- Formatted notification messages with context (trigger reason, current vs previous price)
- Respect user notification preferences and Discord limits
- Logging and error handling for failed notifications

**Acceptance Criteria:**
- Time-based notifications fire at correct intervals
- Price-based notifications trigger when thresholds are met
- Users receive clear, formatted notification messages
- System handles API failures gracefully
- Notifications don't spam users (cooldown periods)

## Technical Implementation

### Database Schema
```sql
-- New table: StockTracking
CREATE TABLE StockTracking (
  id INT PRIMARY KEY AUTO_INCREMENT,
  userId VARCHAR(20) NOT NULL,
  channelId VARCHAR(20) NOT NULL, -- Channel where tracking was set up
  ticker VARCHAR(10) NOT NULL,
  triggerType ENUM('time', 'percentage', 'price_target') NOT NULL,
  triggerValue VARCHAR(50) NOT NULL, -- JSON or string based on type
  lastNotified TIMESTAMP NULL,
  isActive BOOLEAN DEFAULT true,
  createdAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updatedAt TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_user_ticker (userId, ticker),
  INDEX idx_channel (channelId),
  INDEX idx_active (isActive)
);
```

### API Integration

**Selected API: Polygon.io** *(Updated Selection)*

**Rationale for Change:**
**Selected API Provider:** Polygon.io provides excellent free tier coverage for projected usage:

**Free Tier Analysis:**
- **Polygon.io:** 5 calls/minute (7,200/day - 72x requirement) ✅
- **Alpha Vantage:** 25 requests/day (25% of requirement) ❌
- **Yahoo Finance:** Unreliable for production use ❌

**Polygon.io Benefits:**
- **Free Tier:** 5 API calls per minute (7,200/day theoretical)
- **Institutional-Grade Data:** Real-time and historical market data
- **Comprehensive Coverage:** Stocks, options, forex, crypto
- **Low Latency:** <20ms response times
- **Production Ready:** Powers major fintech platforms like Robinhood
- **Existing API Key:** Already available for immediate use

**API Endpoints:**
- **Real-time Quote:** `/v2/aggs/ticker/{symbol}/prev` for previous day data
- **Last Trade:** `/v2/last/trade/{symbol}` for real-time price
- **Daily Bars:** `/v2/aggs/ticker/{symbol}/range/1/day/{from}/{to}` for historical
- **Grouped Daily:** `/v2/aggs/grouped/locale/us/market/stocks/{date}` for market overview

**Implementation Details:**
- **Base URL:** `https://api.polygon.io`
- **Authentication:** API key via query parameter `?apikey=YOUR_API_KEY`
- **Response Format:** JSON
- **Rate Limiting:** 5 calls per minute on free tier
- **Data Caching:** Cache prices for 5 minutes to stay within rate limits
  - *Note: Consider shorter cache (2-3 minutes) for active trading hours based on user feedback*
  - Implement configurable cache duration for different market conditions

**Sample Request:**
```
https://api.polygon.io/v2/aggs/ticker/AAPL/prev?apikey=YOUR_API_KEY
```

**Sample Response Fields:**
- `c` - Close price (current/latest)
- `h` - High price
- `l` - Low price  
- `o` - Open price
- `v` - Volume
- `vw` - Volume weighted average price

**NPM Package:** `@polygon.io/client-js` (official client library)

### Command Structure
```
/stock
├── get <ticker>                    # Phase 1
├── track <ticker> [trigger]        # Phase 2
├── untrack <ticker>               # Phase 2
├── list                           # Phase 2
└── settings [notifications]        # Phase 3
```

### Background Jobs
- Scheduled task system (consider node-cron or bull queue)
- Price monitoring service that checks tracked stocks
- Notification delivery service

## Dependencies

### External APIs
- **Polygon.io API:** Stock market data provider
- **API Key:** Required environment variable `POLYGON_API_KEY`
- **Rate limiting considerations:** 5 calls per minute on free tier
- **Pricing tier:** Free tier sufficient for projected 100 queries/day with caching

### Internal Dependencies
- Database migration for StockTracking table
- Background job scheduler implementation
- Discord permissions for DM sending

### NPM Packages (Estimated)
- `@polygon.io/client-js` - Official Polygon.io API client with TypeScript support
- `node-cron` or `bull` queue for scheduled tasks
- Price formatting utilities (potentially custom)

## Testing Strategy

### Unit Testing Requirements
**Coverage Target:** >90% for all stock-related modules

**Core Components to Test:**
- `PolygonService` class with API integration mocking
- Rate limiting logic (`RateLimiter` class)  
- Cache management and expiration
- Market hours detection logic
- Error handling for all failure scenarios

**Test Scenarios:**
```typescript
// API Integration Tests
- Valid ticker responses (AAPL, TSLA, MSFT)
- Invalid ticker handling (404, invalid format)
- API rate limit exceeded (429 responses) 
- Network timeout and connection failures
- Malformed API responses

// Rate Limiting Tests
- Rapid request sequences (exceed 5/minute)
- Rate limiter queue management
- Cache hit/miss scenarios
- Concurrent request handling

// Command Integration Tests
- Discord slash command validation
- Autocomplete functionality with popular stocks
- Error message formatting and user guidance
- Permission and rate limit warnings
```

### Integration Testing
**API Provider Testing:**
- Live Polygon.io API integration (limited calls)
- Mock server responses for comprehensive error testing
- Network resilience testing (intermittent failures)
- Response time validation (<3 seconds target)

**Database Integration:**
- User tracking persistence and retrieval
- Channel ID association for notifications
- Data migration testing for schema changes

### Performance Testing
**Load Testing:**
- Concurrent user requests (simulate Discord server usage)
- Memory usage monitoring with background jobs
- Cache efficiency under load
- Database query performance (<100ms target)

**Monitoring Setup:**
```bash
# Add to Phase 1C implementation:
- API response time metrics (Sentry performance monitoring)
- Error rate tracking by error type
- Cache hit ratio monitoring  
- Rate limit approach warnings (track users near limits)
```

### Security Testing
**API Key Security:**
- Startup validation: Verify API key format and permissions
- Log sanitization: Ensure API keys never appear in logs/errors
- Parameter Store integration: Secure retrieval and caching
- Request monitoring: Log suspicious usage patterns

**Rate Limiting Security:**
- Per-user rate limiting to prevent abuse
- Global bot rate limiting protection  
- Circuit breaker testing for API failure scenarios

### Test Environment Setup
```bash
# Test configuration
POLYGON_API_KEY=test-key-limited-calls
NODE_ENV=test
DATABASE_URL=sqlite://test.db

# Mock server for comprehensive testing
npm install --save-dev nock  # HTTP request mocking
```

## Success Metrics

### Phase 1
- Command success rate >95%
- Average response time <3 seconds
- Zero API quota exceeded errors

### Phase 2
- User adoption: 10+ users set up tracking within first week
- Database performance: queries <100ms
- User retention: users maintain active tracking

### Phase 3
- Notification reliability: >98% delivery rate
- User satisfaction: <5% untrack rate due to spam
- System stability: zero notification system crashes

## Risk Considerations

### Technical Risks
- **API Rate Limits:** Stock APIs have strict rate limits; need robust queuing
- **API Reliability:** Third-party API outages could break stock functionality
- **API Cost:** Some stock APIs charge per request; monitor usage carefully  
- **Market Hours:** Handle pre/post-market data and market closures
- **Data Accuracy:** Ensure real-time vs delayed data expectations are clear
- **Cache Memory Usage:** Long-running cache could consume excessive memory

### Risk Mitigation Strategies
**API Reliability:**
- Implement circuit breaker pattern (fail fast after 3+ consecutive failures)
- Graceful degradation: Show cached data with timestamps when API unavailable
- API provider migration strategy: Abstract API calls through service layer

**Performance & Scalability:**
- Monitor memory usage with periodic cache cleanup
- Implement request deduplication for concurrent same-ticker requests  
- Add exponential backoff for API retries

**Future Migration Planning:**
- Service abstraction layer to enable API provider switching
- Database schema designed to support multiple data sources
- Configuration-driven API selection (fallback providers)

### User Experience Risks
- **Notification Fatigue:** Aggressive tracking could annoy users
- **Timezone Issues:** Stock market times vs user timezones
- **Mobile Notifications:** Discord notification settings may block DMs

## Open Questions

1. ~~**API Provider:** Which stock data API offers best price/feature ratio?~~ **RESOLVED:** Polygon.io selected for institutional-grade data and generous free tier (5 calls/minute vs Alpha Vantage's 25 requests/day)
2. **Real-time vs Delayed:** Is 15-minute delayed data acceptable, or do we need real-time?
3. **Supported Markets:** Start with US only, or include international exchanges?
4. **User Limits:** How many stocks can a single user track simultaneously?
5. **Historical Data:** Should we support price history charts in future phases?

## Implementation Approach - Granular Phases

### Phase 1A: Core API Integration (2-3 days)
- Create Polygon.io API utility service
- Implement basic stock data fetching function with rate limiting
- Add environment variable for API key (`POLYGON_API_KEY`) with startup validation
- Unit tests for API service with comprehensive mocking
- Integration tests for API reliability and error scenarios

### Phase 1B: Basic Stock Command (2-3 days)  
- Create `/stock get <ticker>` slash command structure
- Implement command handler with API integration
- Create Discord embed for stock data display
- Comprehensive error handling for invalid tickers, API failures, and network timeouts
- API key validation on service initialization
- Circuit breaker pattern for API reliability

### Phase 1C: Command Polish & Testing (1-2 days)
- Add comprehensive error messages with user guidance
- Implement proactive rate limiting protection (warn at 2 requests remaining)
- Add command validation and autocomplete with popular stock symbols
- Integration testing with API mocking
- Test coverage target: >90% for stock-related modules

**Phase 1 Total:** 5-8 days

### Phase 2A: Database Setup (1-2 days)
- Create StockTracking migration
- Run database migration
- Create Sequelize model for StockTracking table

### Phase 2B: Track Command Foundation (2-3 days)
- Create `/stock track <ticker>` basic command structure
- Implement database insert for tracking entries
- Basic validation for ticker symbols

### Phase 2C: Track Management Commands (2-3 days)
- Implement `/stock list` to show user's tracking
- Implement `/stock untrack <ticker>` to remove tracking
- Add user-friendly display formatting

**Phase 2 Total:** 5-8 days

### Phase 3A: Background Job Infrastructure (2-3 days)
- Set up node-cron or job scheduling system  
- Create basic job that queries tracked stocks
- Add logging system for background jobs

### Phase 3B: Notification Logic (2-3 days)
- Implement price change detection algorithms
- Create notification message formatting
- Add cooldown/throttling logic

### Phase 3C: Notification Delivery (2-3 days)
- Implement Discord channel message sending to stored channel IDs
- Add error handling for failed notifications (channel deleted, no permissions, etc.)
- Create notification history tracking

**Phase 3 Total:** 6-9 days

## Timeline Summary

**Total Implementation:** 16-25 days (3-5 weeks) broken into **9 smaller phases**

**Benefits of Granular Approach:**
- Each phase is 1-3 days of focused work
- Can deploy and test incrementally
- Easier to debug and maintain
- Can reprioritize between phases if needed
- Reduces risk of large feature failures

## Deployment Plan

### Phase 1C Early Release Deployment

**Prerequisites:**
- [x] Phase 1C implementation complete with all tests passing
- [x] ESLint validation passing 
- [x] Code committed to feature branch

**Deployment Steps:**

#### 1. **Environment Configuration**
- [ ] Add `POLYGON_API_KEY` to AWS Systems Manager Parameter Store
  ```bash
  aws ssm put-parameter \
    --name "/alia-bot/prod/POLYGON_API_KEY" \
    --value "your-polygon-api-key" \
    --type "SecureString" \
    --description "Polygon.io API key for stock data"
  ```
- [ ] Add to ECS task definition secrets (if using ECS):
  ```json
  {
    "name": "POLYGON_API_KEY", 
    "valueFrom": "arn:aws:ssm:us-east-1:319709948884:parameter/alia-bot/prod/POLYGON_API_KEY"
  }
  ```
  ```bash
  # Update ECS task definition (example)
  aws ecs describe-task-definition --task-definition alia-bot-prod --query taskDefinition > task-def.json
  # Edit task-def.json to add the secret above to the "secrets" array
  aws ecs register-task-definition --cli-input-json file://task-def.json
  # Update ECS service to use new task definition revision
  ```
- [ ] Update production environment to load from Parameter Store  
- [ ] Verify environment variable is accessible in production:
  ```bash
  # Test parameter retrieval
  aws ssm get-parameter --name "/alia-bot/prod/POLYGON_API_KEY" --with-decryption
  
  # In production environment, verify bot can access it
  # Check bot logs for successful Polygon service initialization
  ```

#### 2. **Code Deployment**
- [ ] Merge **PR #214** (`feature/stock-ticker-prd` → `master`)
- [ ] Run production deployment script: `scripts/deploy.sh`
  ```bash
  # Production deployment process:
  # 1. Pull latest master branch
  # 2. Install dependencies (npm ci)
  # 3. Build TypeScript (npm run build)
  # 4. Restart bot with forever
  ```
- [ ] Verify bot startup and connection to Discord
- [ ] Check logs for any initialization errors

#### 3. **Discord Command Registration**
- [ ] Build TypeScript commands: `npm run build`
- [ ] Deploy slash commands globally: `node scripts/deploy-commands.js`
  ```bash
  # This script will:
  # 1. Load all commands from dist/src/commands/
  # 2. Register them globally with Discord API
  # 3. Confirm successful deployment
  ```
- [ ] Verify `/stock` command appears in Discord with autocomplete
- [ ] Test command execution with a simple ticker (e.g., `AAPL`)

#### 4. **Production Testing**
- [ ] **Basic Functionality Test:**
  - Execute `/stock get AAPL` 
  - Verify proper embed display with real data
  - Confirm rate limiting warnings work
  
- [ ] **Error Handling Test:**
  - Test invalid ticker (`/stock get INVALID123`)
  - Test rate limit exceeded (make 6+ rapid requests)
  - Verify error messages are user-friendly

- [ ] **Autocomplete Test:**
  - Type `/stock get` and verify stock suggestions appear
  - Test filtering by typing "AA" or "apple"
  - Confirm 25-item limit and proper filtering

#### 5. **Monitoring & Rollback Plan**
- [ ] Monitor Sentry for any new errors after deployment
- [ ] Check CloudWatch logs for API call patterns
- [ ] Monitor Polygon.io API usage to ensure staying within limits
- [ ] **Rollback Plan:** Keep previous deployment ready for quick revert if issues arise

#### 6. **User Communication**
- [ ] Announce new `/stock get` command in Discord
- [ ] Provide basic usage examples
- [ ] Set expectations about rate limits (5 requests/minute)

### Missing Considerations Checklist

**Security:**
- [ ] Ensure Polygon API key is stored securely (Parameter Store/SecureString) ✓
- [ ] Verify no API keys in committed code ✓
- [ ] Rate limiting protects against abuse ✓

**Performance:**
- [ ] API response caching implemented (5-minute cache) ✓
- [ ] Rate limiting prevents API quota exhaustion ✓
- [ ] Error handling prevents infinite loops ✓

**Monitoring:**
- [ ] Error logging via Sentry ✓
- [ ] API call logging for debugging ✓
- [ ] Rate limit status tracking ✓

**Documentation:**
- [ ] Update CHANGELOG.md with new feature
- [ ] Update COMMANDS.md with `/stock get` usage
- [ ] Internal documentation for troubleshooting

**Discord Bot Permissions:**
- [ ] Verify bot has `Send Messages` permission
- [ ] Verify bot has `Use Slash Commands` permission
- [ ] Verify bot has `Embed Links` permission for rich embeds

**API Quotas:**
- [ ] Confirm Polygon.io free tier limits (5 requests/minute) ✓
- [ ] Monitor actual usage vs quotas
- [ ] Plan for potential upgrade if usage grows

### Post-Deployment Monitoring (First 48 Hours)

1. **Usage Metrics:**
   - Track number of stock requests
   - Monitor most requested tickers
   - Watch for rate limiting frequency

2. **Error Monitoring:**
   - API failures and causes
   - Invalid ticker requests
   - Network/timeout errors

3. **Performance:**
   - Response time metrics
   - Cache hit rates
   - Memory usage patterns

### Future Deployment Considerations

**Phase 2A+ Deployments:**
- Database migrations will require careful coordination
- Background jobs will need separate deployment considerations
- Notification systems will require additional permissions