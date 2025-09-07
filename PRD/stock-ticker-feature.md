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
IEX Cloud is no longer available. Polygon.io provides excellent free tier coverage for projected usage:

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
- **Data Caching:** Cache prices for 1-5 minutes to stay within rate limits

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

**NPM Package:** `@polygon.io/client-js` or custom HTTP client with axios

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
- **Polygon.io API:** Stock market data provider *(Updated from IEX Cloud)*
- **API Key:** Required environment variable `POLYGON_API_KEY`
- **Rate limiting considerations:** 5 calls per minute on free tier
- **Pricing tier:** Free tier sufficient for projected 100 queries/day with caching

### Internal Dependencies
- Database migration for StockTracking table
- Background job scheduler implementation
- Discord permissions for DM sending

### NPM Packages (Estimated)
- `@polygon.io/client-js` - Official Polygon.io API client *(Updated from iex-api)*
- `axios` - HTTP client for API requests (if not using official client)
- `node-cron` or `bull` queue for scheduled tasks
- Price formatting utilities (potentially custom)

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
- **API Cost:** Some stock APIs charge per request; monitor usage carefully
- **Market Hours:** Handle pre/post-market data and market closures
- **Data Accuracy:** Ensure real-time vs delayed data expectations are clear

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
- Add environment variable for API key (`POLYGON_API_KEY`)
- Unit tests for API service

### Phase 1B: Basic Stock Command (2-3 days)  
- Create `/stock get <ticker>` slash command structure
- Implement command handler with API integration
- Create Discord embed for stock data display
- Basic error handling for invalid tickers

### Phase 1C: Command Polish & Testing (1-2 days)
- Add comprehensive error messages
- Implement rate limiting protection
- Add command validation and autocomplete
- Integration testing

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