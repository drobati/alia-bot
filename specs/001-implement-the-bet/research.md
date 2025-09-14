# Technical Research: Discord Bot Engagement Currency & Betting System

**Date**: 2025-09-11  
**Feature**: Discord Bot Betting System with Engagement Currency  

## Research Findings

### Discord.js v14 Advanced Interaction Patterns for Betting Interfaces

**Decision**: Use Discord's ActionRow components with Button interactions and Modal forms for complex betting UI

**Rationale**: 
- ActionRows with Buttons provide immediate interaction without slash command delays
- Modal forms allow multi-field input for bet creation with validation
- SelectMenu components enable dropdown selection for bet sides and user assignment
- Interaction.update() and Interaction.followUp() enable real-time bet state updates
- ComponentCollector allows timed interactions that auto-expire with bet deadlines

**Alternatives considered**:
- Pure slash commands: Too rigid, no real-time updates
- Reaction-based UI: Limited interaction types, hard to prevent abuse
- External web interface: Breaks Discord-native experience

**Implementation approach**:
```typescript
// Betting interface with ActionRow buttons
const betEmbed = new EmbedBuilder()
    .setTitle(`Bet: ${statement}`)
    .addFields([
        { name: 'For', value: `${forTotal} Sparks (${forCount} users)`, inline: true },
        { name: 'Against', value: `${againstTotal} Sparks (${againstCount} users)`, inline: true }
    ]);

const row = new ActionRowBuilder<ButtonBuilder>()
    .addComponents([
        new ButtonBuilder().setCustomId('bet-join-for').setLabel('Join For').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setCustomId('bet-join-against').setLabel('Join Against').setStyle(ButtonStyle.Secondary),
        new ButtonBuilder().setCustomId('bet-view-details').setLabel('View Details').setStyle(ButtonStyle.Success)
    ]);
```

### MySQL Transaction Handling for Escrow Operations

**Decision**: Use Sequelize managed transactions with explicit rollback for all currency operations

**Rationale**:
- Escrow operations require atomic balance updates across multiple tables
- Managed transactions provide automatic rollback on errors
- Row-level locking prevents race conditions during concurrent betting
- Transaction isolation level READ_COMMITTED prevents phantom reads
- Connection pooling handles high-frequency balance updates efficiently

**Alternatives considered**:
- Unmanaged transactions: Error-prone, manual rollback management
- Application-level locking: Doesn't protect against database failures
- Event sourcing: Overcomplicated for betting use case

**Implementation approach**:
```typescript
await sequelize.transaction(async (t) => {
    // Lock user balance for update
    const userBalance = await BetBalances.findOne({
        where: { user_id: userId },
        lock: t.LOCK.UPDATE,
        transaction: t
    });

    // Validate sufficient funds
    if (userBalance.current_balance < betAmount) {
        throw new Error('Insufficient funds');
    }

    // Update balance and escrow
    await userBalance.update({
        current_balance: userBalance.current_balance - betAmount,
        escrow_balance: userBalance.escrow_balance + betAmount
    }, { transaction: t });

    // Record transaction in ledger
    await BetLedger.create({
        user_id: userId,
        type: 'escrow_in',
        amount: betAmount,
        ref_type: 'bet',
        ref_id: betId
    }, { transaction: t });
});
```

### Anti-Spam and Rate Limiting Patterns for Discord Bots

**Decision**: Multi-tier rate limiting with Redis backing and progressive penalties

**Rationale**:
- In-memory rate limiting for fast response (60-second cooldowns)
- Redis backing for persistent rate limit tracking across bot restarts  
- Progressive penalties: warnings → temp mute → longer mute
- Message quality scoring: length + attachments + reactions within time window
- Channel-based exclusions prevent farming in designated channels

**Alternatives considered**:
- Discord native rate limiting: Too coarse-grained for engagement earning
- Pure in-memory: Lost on bot restart, no persistence
- Database-only: Too slow for real-time rate limiting

**Implementation approach**:
```typescript
class EngagementRateLimiter {
    private limits = new Map<string, UserLimits>();

    async checkEarnEligibility(userId: string, message: Message): Promise<boolean> {
        const userLimits = this.getUserLimits(userId);
        
        // Check cooldown (60 seconds)
        if (Date.now() - userLimits.lastEarnTime < 60000) {
            return false;
        }

        // Check daily limits (25 Sparks, 15 events)
        if (userLimits.dailyEarned >= 25 || userLimits.dailyEvents >= 15) {
            return false;
        }

        // Check spam detection (>6 messages in 10 min without engagement)
        const spamScore = await this.calculateSpamScore(userId, message);
        if (spamScore > 6) {
            userLimits.suppressedUntil = Date.now() + (60 * 60 * 1000); // 1 hour
            return false;
        }

        return true;
    }
}
```

### Discord Embed and Button Interaction Performance Optimization

**Decision**: Embed pagination with component state caching and interaction deferral

**Rationale**:
- Large bet lists require pagination to fit Discord's 25 field limit
- Component collectors with 15-minute timeouts prevent memory leaks
- Interaction.deferUpdate() prevents "Interaction failed" errors during processing
- Embed caching reduces API calls for frequently viewed bets
- Batch updates for multiple bet state changes

**Alternatives considered**:
- Single massive embed: Exceeds Discord limits, poor UX
- Multiple message replies: Clutters chat, hard to track
- External pagination service: Adds complexity, breaks Discord flow

**Implementation approach**:
```typescript
class BetPaginationManager {
    private embedCache = new Map<string, EmbedBuilder>();

    async createPaginatedBetList(bets: Bet[], interaction: CommandInteraction) {
        const pages = this.paginateBets(bets, 10); // 10 bets per page
        let currentPage = 0;

        const embed = this.createBetListEmbed(pages[currentPage]);
        const row = this.createPaginationButtons(currentPage, pages.length);

        const response = await interaction.reply({
            embeds: [embed],
            components: [row],
            ephemeral: true
        });

        const collector = response.createMessageComponentCollector({
            time: 15 * 60 * 1000 // 15 minutes
        });

        collector.on('collect', async (i) => {
            await i.deferUpdate();
            // Handle pagination logic...
        });
    }
}
```

## Technical Decisions Summary

| Component | Technology | Rationale |
|-----------|------------|-----------|
| **Discord UI** | ActionRow + Buttons + Modals | Real-time interactions, native Discord UX |
| **Database Transactions** | Sequelize managed transactions | Atomic operations, automatic rollback |
| **Rate Limiting** | In-memory + Redis hybrid | Fast response, persistent across restarts |
| **Performance** | Embed caching + pagination | Handles large datasets, prevents API limits |
| **Anti-Abuse** | Progressive penalties + quality scoring | Prevents spam while rewarding engagement |

## Performance Benchmarks

Based on research of similar Discord bots:
- **Target Response Time**: <200ms for slash commands
- **Concurrent Users**: Handle 1000+ simultaneous users
- **Database Operations**: <50ms for balance queries with proper indexing
- **Memory Usage**: <100MB additional for betting system components
- **Rate Limiting**: 99.9% accuracy with <10ms overhead

## Risk Mitigation

| Risk | Mitigation Strategy |
|------|-------------------|
| **Race Conditions** | Row-level locking in transactions |
| **API Rate Limits** | Embed caching and batch operations |
| **Spam Gaming** | Multi-tier rate limiting with quality scoring |
| **Database Failure** | Transaction rollbacks and error logging |
| **Memory Leaks** | Component collector cleanup and timeouts |