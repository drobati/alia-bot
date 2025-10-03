# Feature Specification: Discord Bot Engagement Currency & Betting System

**Feature Branch**: `001-implement-the-bet`  
**Created**: 2025-09-11  
**Status**: Updated (2025-10-01)  
**Input**: User description: "Implement the /bet System with Engagement Currency feature for Alia Discord bot. Create a comprehensive wagering game system with Sparks currency that users earn through Discord engagement and can wager on user-created bets."

## Execution Flow (main)
```
1. Parse user description from Input
   → SUCCESS: Feature involves Discord engagement currency and betting system
2. Extract key concepts from description
   → Actors: Discord users, moderators
   → Actions: earn currency, create bets, join bets, settle bets, check balances
   → Data: user balances, bet records, engagement tracking, transaction history
   → Constraints: anti-abuse measures, daily limits, privacy controls
3. For each unclear aspect:
   → Marked with [NEEDS CLARIFICATION] where appropriate
4. Fill User Scenarios & Testing section
   → Clear user flow: earn currency → create/join bets → settle outcomes
5. Generate Functional Requirements
   → All requirements testable and measurable
6. Identify Key Entities (data involved)
   → Users, currency balances, bets, transactions, engagement records
7. Run Review Checklist
   → No implementation details included
   → Focus on user value and business requirements
8. Return: SUCCESS (spec ready for planning)
```

---

## ⚡ Quick Guidelines
- ✅ Focus on WHAT users need and WHY
- ❌ Avoid HOW to implement (no tech stack, APIs, code structure)
- 👥 Written for business stakeholders, not developers

---

## User Scenarios & Testing *(mandatory)*

### Primary User Story
Discord users participate in a server economy where they earn "Sparks" currency through meaningful engagement (posting quality messages, receiving reactions, participating in conversations). Users can then wager their earned Sparks on community-created prediction markets, creating social betting experiences around real-world events, server happenings, or hypothetical questions.

### Acceptance Scenarios
1. **Given** a new user joins the server, **When** they post their first qualifying message (15+ characters), **Then** they receive 100 starting Sparks plus 1 Spark for the message plus 2 Sparks daily bonus (total: 103 Sparks) and see their balance update
2. **Given** a user has 50 Sparks, **When** they create a bet "Will it rain tomorrow? (Ends: 6pm)" wagering 10 Sparks, **Then** 10 Sparks move to escrow and other users see an interactive betting interface
3. **Given** multiple users have joined a bet with 30 Sparks total wagered, **When** a moderator settles the bet as "for", **Then** winners receive payouts proportional to the odds while losers forfeit their stakes
4. **Given** a user wants to check their financial status, **When** they use the balance command, **Then** they see current available balance, amount in active bets, lifetime earnings/spending, and recent transaction history
5. **Given** a user wants to find someone, **When** they check when another user was last seen, **Then** they see the timestamp and channel (or "hidden" if user has privacy enabled)

### Edge Cases
- What happens when a user tries to bet more Sparks than they have available? (Addressed in FR-011)
- How does the system handle bet settlements when the outcome is disputed or unclear? (Moderators use "void" outcome per FR-013)
- What prevents users from gaming the engagement system with spam messages? (Addressed in FR-004, FR-005, FR-006)
- How are timezone differences handled for bet end times? (All times stored in UTC, displayed in user's timezone)
- What happens to escrowed Sparks if a bet creator abandons their bet? (Addressed in FR-026: auto-void after 7 days)

## Requirements *(mandatory)*

### Functional Requirements

#### Currency System
- **FR-001**: System MUST award new users 100 Sparks upon first interaction
- **FR-002**: System MUST award 1 Spark per qualifying message (≥15 characters OR contains attachment OR receives ≥1 reaction within 10 minutes)
- **FR-003**: System MUST provide daily participation bonus of 2 Sparks on first qualifying message each day
- **FR-004**: System MUST enforce daily earning limits: maximum 25 Sparks OR 15 earning events per day (whichever is reached first)
- **FR-005**: System MUST implement 60-second cooldown between earning events to prevent spam
- **FR-006**: System MUST suppress earning for users posting >6 qualifying messages in 10 minutes when those messages receive zero reactions or replies from other users (excluding self-reactions and bot reactions), suppression lasts until next hour
- **FR-007**: System MUST track all Spark movements in a permanent transaction ledger for auditing

#### Betting System
- **FR-008**: Users MUST be able to create bets with custom statements, wager amounts, end times, and odds ratios
- **FR-009**: System MUST move wagered Sparks to escrow immediately upon bet creation or joining
- **FR-010**: Users MUST be able to join existing open bets on either "for" or "against" side within the time window
- **FR-011**: System MUST prevent users from wagering more Sparks than their current available balance
- **FR-012**: System MUST display interactive betting interfaces showing current participants, odds, total escrow, and time remaining
- **FR-013**: Only moderators MUST be able to settle bets with outcomes of "for", "against", or "void"
- **FR-014**: System MUST distribute winnings based on odds ratios and return stakes to void bets
- **FR-015**: Bet creators MUST be able to cancel bets only if no other participants have joined

#### Balance & Transaction Management
- **FR-016**: Users MUST be able to check their own balance showing available Sparks, escrowed amounts, lifetime totals, and recent transactions
- **FR-017**: System MUST calculate available balance as: total earned - total spent - current escrow
- **FR-018**: All balance changes MUST be recorded with transaction type, amount, reference, and timestamp
- **FR-019**: Users MUST be able to view their betting participation history including active and settled bets

#### Social Features
- **FR-020**: Users MUST be able to query when other users were last seen including timestamp and channel location
- **FR-021**: Users MUST be able to enable privacy mode to hide their last seen information from others
- **FR-022**: System MUST respect user privacy settings and return "unavailable" for hidden users

#### Anti-Abuse & Moderation
- **FR-023**: System MUST exclude bot messages, self-reactions, and designated no-earning channels from Spark generation
- **FR-024**: Moderators MUST have administrative commands to view user balances and transaction histories for moderation purposes
- **FR-025**: System MUST log all bet settlements with moderator attribution for accountability
- **FR-026**: System MUST automatically void bets that remain unsettled for 7 days after their closing time and refund all escrowed Sparks to participants proportionally

### Key Entities *(include if feature involves data)*
- **User**: Represents Discord guild members with unique balance tracking, privacy settings, earning statistics, and engagement history
- **Currency Balance**: User's financial state including available Sparks, escrowed amounts in active bets, lifetime earnings/spending totals
- **Transaction**: Individual Spark movement record with type (earn/spend/escrow/payout), amount, reference data, and timestamp for complete audit trail
- **Bet**: Community prediction market with statement, odds, end time, current participants on each side, total escrow, and settlement status
- **Bet Participation**: User's involvement in specific bet including which side, amount wagered, join timestamp, and payout calculation
- **Engagement Stats**: User's activity tracking for anti-abuse including daily message counts, earning events, last reset timestamp, and spam detection

---

## Review & Acceptance Checklist
*GATE: Automated checks run during main() execution*

### Content Quality
- [x] No implementation details (languages, frameworks, APIs)
- [x] Focused on user value and business needs
- [x] Written for non-technical stakeholders
- [x] All mandatory sections completed

### Requirement Completeness
- [x] No [NEEDS CLARIFICATION] markers remain
- [x] Requirements are testable and unambiguous  
- [x] Success criteria are measurable
- [x] Scope is clearly bounded
- [x] Dependencies and assumptions identified

---

## Execution Status
*Updated by main() during processing*

- [x] User description parsed
- [x] Key concepts extracted
- [x] Ambiguities marked
- [x] User scenarios defined
- [x] Requirements generated
- [x] Entities identified
- [x] Review checklist passed

---