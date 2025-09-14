# Quickstart Guide: Discord Bot Betting System

**Date**: 2025-09-11  
**Feature**: Discord Bot Engagement Currency & Betting System  
**Test Environment**: Development Discord server with bot permissions  

## Prerequisites

- Alia bot deployed with new betting commands registered
- MySQL database with betting system tables migrated
- Test Discord server with 3+ users for interaction testing
- Bot has necessary permissions: Send Messages, Use Slash Commands, Embed Links, Use External Emojis

## Test Scenarios

### Scenario 1: New User Onboarding & First Sparks
**Goal**: Verify new users receive starting balance and can earn Sparks through engagement

**Steps**:
1. **Join server with fresh Discord account** (not in betting system yet)
2. **Post qualifying message**: "This is my first message, let's test the betting system!"
   - Message is >15 characters ✓
3. **Check balance**: `/balance`
   - Expected: 101 Sparks (100 starting + 1 from message + 2 daily bonus)
4. **Post another message** within 60 seconds
   - Expected: No additional Sparks (cooldown active)
5. **Wait 61 seconds and post** another qualifying message
   - Expected: +1 Spark (cooldown reset)
6. **Have another user react** to your message within 10 minutes
   - Expected: +1 Spark (reaction bonus)

**Expected Result**: User balance shows 103 Sparks total, transaction history shows earn events

### Scenario 2: Creating and Joining Bets
**Goal**: Test full betting workflow from creation to participation

**Steps**:
1. **User A creates bet**: `/bet open amount:25 statement:"Will it rain tomorrow?" ends:6h`
   - Expected: Bet created with UUID, 25 Sparks moved to escrow
   - Expected: Interactive embed with [Join For], [Join Against], [View Details] buttons
2. **User A checks balance**: `/balance`
   - Expected: Available balance reduced by 25, escrow balance increased by 25
3. **User B clicks [Join For]** button
   - Expected: Modal appears asking for wager amount
4. **User B submits** 15 Sparks for "for" side
   - Expected: Bet embed updates showing 40 total for "for" side (25+15)
   - Expected: User B balance reduced by 15
5. **User C clicks [Join Against]** button and wagers 20 Sparks
   - Expected: Bet embed shows 40 "for" vs 20 "against"
6. **Anyone clicks [View Details]**
   - Expected: Detailed embed showing participants, odds, time remaining

**Expected Result**: Active bet with 3 participants, correct escrow totals, updated embeds

### Scenario 3: Bet Settlement & Payouts
**Goal**: Test moderator settlement and payout calculations

**Steps**:
1. **Use bet from Scenario 2** (40 Sparks "for", 20 Sparks "against")
2. **Moderator settles**: `/bet settle id:bet-uuid outcome:for`
   - Expected: Winners (User A + B) receive proportional payouts
   - User A: 25 stake + (25/40 * 20) = 25 + 12.5 = 37.5 ≈ 37 Sparks
   - User B: 15 stake + (15/40 * 20) = 15 + 7.5 = 22.5 ≈ 23 Sparks  
   - User C: Loses 20 Sparks (moved to winners)
3. **Check all user balances** 
   - Expected: Escrow amounts cleared, winnings added to available balance
4. **Check transaction history**
   - Expected: Ledger shows escrow_out + payout entries for winners, spend for loser

**Expected Result**: Correct payout distribution, zero escrow balances, complete audit trail

### Scenario 4: Anti-Abuse & Rate Limiting
**Goal**: Test spam prevention and earning caps

**Steps**:
1. **User posts 7 messages rapidly** (within 10 minutes) without reactions
   - Expected: After 6th message, earning suppressed until next hour
2. **Try to earn 26 Sparks in one day** through various methods
   - Expected: Daily cap of 25 Sparks enforced
3. **Post message and immediately post another**
   - Expected: Second message doesn't earn due to 60-second cooldown
4. **Test invalid bet amounts**: Try to bet more Sparks than available balance
   - Expected: Error message, no escrow movement

**Expected Result**: Rate limits enforced, daily caps respected, balance validation works

### Scenario 5: Social Features & Privacy
**Goal**: Test last seen functionality and privacy controls

**Steps**:
1. **User A posts message** in #general channel
2. **User B checks**: `/lastseen user:@UserA`
   - Expected: Shows timestamp, channel name, relative time
3. **User A enables privacy**: (would need privacy toggle command)
   - For testing: manually set `hide_last_seen = true` in database
4. **User B checks again**: `/lastseen user:@UserA`
   - Expected: Returns "unavailable" message
5. **Check non-existent user**: `/lastseen user:@FakeUser`
   - Expected: "User not found" error

**Expected Result**: Last seen data accurate, privacy controls respected

## Performance Validation

### Response Time Checks
- **Slash commands** should respond within 200ms
- **Button interactions** should defer and update within 500ms  
- **Balance queries** with transaction history should complete <100ms
- **Bet list pagination** should handle 50+ bets smoothly

### Stress Testing (if possible)
- **Concurrent bet creation**: 5+ users creating bets simultaneously
- **High-frequency earning**: Multiple users messaging at rate limits
- **Large bet participation**: 20+ users joining same bet
- **Database consistency**: Verify balance calculations remain accurate

## Troubleshooting Common Issues

### Bot Not Responding
- Check bot permissions and slash command registration
- Verify database connection and table existence
- Check Discord API rate limiting in logs

### Balance Inconsistencies  
- Run balance reconciliation against ledger table
- Check transaction rollback logs for failed operations
- Verify trigger consistency checks are working

### Interaction Timeouts
- Check component collector cleanup
- Verify interaction deferral for long operations
- Monitor Discord interaction 15-minute limits

## Success Criteria Checklist

**Currency System**:
- [✓] New users receive 100 starting Sparks
- [✓] Qualifying messages award 1 Spark with cooldowns
- [✓] Daily participation bonus works
- [✓] Rate limiting prevents spam abuse
- [✓] Transaction history is complete and accurate

**Betting System**:
- [✓] Bet creation moves correct amount to escrow  
- [✓] Interactive embeds update in real-time
- [✓] Joining validation prevents overspeanding
- [✓] Settlement distributes winnings correctly
- [✓] Moderator-only settlement restrictions work

**Social Features**:
- [✓] Last seen shows accurate activity data
- [✓] Privacy settings hide information when enabled
- [✓] User lookup handles non-existent users gracefully

**Performance & Reliability**:
- [✓] All operations complete within target response times
- [✓] Database consistency maintained under load
- [✓] Error handling provides helpful user feedback
- [✓] Component interactions don't leak memory

---

**Next Phase**: Once all quickstart scenarios pass, proceed to `/tasks` command for detailed implementation planning.