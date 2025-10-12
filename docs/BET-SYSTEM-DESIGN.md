# /bet System - Comprehensive Design Specification

## Overview
The `/bet` system introduces a lightweight wagering game with engagement-based currency earning for Discord communities. Users earn "Sparks" through meaningful participation and can wager them on community predictions and events.

## System Architecture

### Core Components
1. **Engagement Engine** - Tracks user activity and awards Sparks
2. **Betting Engine** - Handles bet creation, joining, and settlement
3. **Balance System** - Manages user currency and transaction ledger
4. **Social Features** - Activity tracking and user interaction
5. **Anti-Abuse Layer** - Spam prevention and rate limiting

## Currency System: "Sparks" 💫

### Configuration
```javascript
const CURRENCY_CONFIG = {
  name: process.env.CURRENCY_NAME || 'Sparks',
  emoji: process.env.CURRENCY_EMOJI || '💫',
  startingBalance: parseInt(process.env.STARTING_BALANCE) || 100,
  dailyCap: parseInt(process.env.DAILY_EARN_CAP) || 25,
  alternatives: ['Shards', 'Embers', 'Credits', 'Cores', 'Tokens', 'Orbs', 'Grit', 'Zaps', 'Quanta', 'Chits', 'Stubs']
};
```

### Display Format
- **Standard**: "50 Sparks"
- **With Emoji**: "50 💫"
- **Compact**: "50S" (for embeds)

## Database Schema

### User Management
```sql
CREATE TABLE bet_users (
    id BIGSERIAL PRIMARY KEY,
    discord_id VARCHAR(255) UNIQUE NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    discriminator VARCHAR(10),
    hide_last_seen BOOLEAN DEFAULT FALSE,
    privacy_level ENUM('open', 'friends', 'private') DEFAULT 'open',
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(discord_id, guild_id)
);

CREATE INDEX idx_bet_users_discord_guild ON bet_users(discord_id, guild_id);
CREATE INDEX idx_bet_users_guild ON bet_users(guild_id);
```

### Balance & Transactions
```sql
CREATE TABLE bet_balances (
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    current_balance INTEGER DEFAULT 100 CHECK (current_balance >= 0),
    escrow_balance INTEGER DEFAULT 0 CHECK (escrow_balance >= 0),
    lifetime_earned INTEGER DEFAULT 100, -- Include starting balance
    lifetime_spent INTEGER DEFAULT 0,
    total_bets_created INTEGER DEFAULT 0,
    total_bets_joined INTEGER DEFAULT 0,
    total_winnings INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id)
);

CREATE TABLE bet_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    transaction_type ENUM(
        'initial_grant',    -- Starting balance
        'earn_message',     -- Message-based earning
        'earn_participation', -- Daily participation bonus
        'earn_thread',      -- Thread engagement bonus
        'earn_reaction',    -- Reaction bonus
        'bet_escrow_in',    -- Money goes into escrow for bet
        'bet_escrow_out',   -- Money leaves escrow (win/lose/refund)
        'bet_payout',       -- Winnings distributed
        'bet_refund',       -- Bet voided/cancelled
        'admin_adjustment', -- Manual balance adjustment
        'penalty'          -- Anti-abuse deduction
    ) NOT NULL,
    amount INTEGER NOT NULL, -- Positive for credits, negative for debits
    running_balance INTEGER NOT NULL, -- Balance after this transaction
    reference_type VARCHAR(50), -- 'bet', 'message', 'daily_bonus', etc.
    reference_id VARCHAR(255),  -- bet_id, message_id, etc.
    metadata JSONB, -- Additional context (channel, message content preview, etc.)
    created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_ledger_user_created ON bet_ledger(user_id, created_at);
CREATE INDEX idx_ledger_type ON bet_ledger(transaction_type);
CREATE INDEX idx_ledger_reference ON bet_ledger(reference_type, reference_id);
```

### Engagement System
```sql
CREATE TABLE bet_engagement_stats (
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    guild_id VARCHAR(255) NOT NULL,
    message_count INTEGER DEFAULT 0,
    qualifying_message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP,
    last_message_channel_id VARCHAR(255),
    daily_earn_count INTEGER DEFAULT 0,
    daily_earn_amount INTEGER DEFAULT 0,
    last_earn_at TIMESTAMP,
    last_earn_reset DATE DEFAULT CURRENT_DATE,
    consecutive_days INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    spam_score INTEGER DEFAULT 0, -- Anti-abuse metric
    spam_reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, guild_id)
);

CREATE INDEX idx_engagement_last_message ON bet_engagement_stats(last_message_at);
CREATE INDEX idx_engagement_daily_reset ON bet_engagement_stats(last_earn_reset);
```

### Betting System
```sql
CREATE TABLE bet_wagers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    guild_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255), -- Discord message ID for the bet embed
    opener_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    
    -- Bet Details
    statement TEXT NOT NULL CHECK (LENGTH(statement) BETWEEN 10 AND 500),
    description TEXT, -- Optional longer description
    odds_for INTEGER DEFAULT 1 CHECK (odds_for BETWEEN 1 AND 10),
    odds_against INTEGER DEFAULT 1 CHECK (odds_against BETWEEN 1 AND 10),
    
    -- Financial
    opener_amount INTEGER NOT NULL CHECK (opener_amount > 0),
    total_for_amount INTEGER DEFAULT 0,
    total_against_amount INTEGER DEFAULT 0,
    house_edge_percentage INTEGER DEFAULT 0, -- Future: configurable house edge
    
    -- Status & Timing
    status ENUM('open', 'closed', 'settled', 'voided', 'cancelled') DEFAULT 'open',
    opens_at TIMESTAMP DEFAULT NOW(),
    closes_at TIMESTAMP NOT NULL,
    settled_at TIMESTAMP,
    outcome ENUM('for', 'against', 'void') NULL,
    
    -- Metadata
    category VARCHAR(50), -- 'sports', 'weather', 'entertainment', 'community', etc.
    tags TEXT[], -- Searchable tags
    
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    
    CHECK (closes_at > opens_at),
    CHECK (status != 'settled' OR outcome IS NOT NULL),
    CHECK (status != 'settled' OR settled_at IS NOT NULL)
);

CREATE INDEX idx_wagers_status ON bet_wagers(status);
CREATE INDEX idx_wagers_closes_at ON bet_wagers(closes_at);
CREATE INDEX idx_wagers_guild ON bet_wagers(guild_id);
CREATE INDEX idx_wagers_category ON bet_wagers(category);
CREATE INDEX idx_wagers_opener ON bet_wagers(opener_id);

CREATE TABLE bet_participants (
    id BIGSERIAL PRIMARY KEY,
    bet_id UUID REFERENCES bet_wagers(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    side ENUM('for', 'against') NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    potential_payout INTEGER, -- Calculated at join time based on odds
    actual_payout INTEGER,    -- Set when bet is settled
    joined_at TIMESTAMP DEFAULT NOW(),
    
    UNIQUE(bet_id, user_id, side) -- User can only join each side once
);

CREATE INDEX idx_participants_bet ON bet_participants(bet_id);
CREATE INDEX idx_participants_user ON bet_participants(user_id);
CREATE INDEX idx_participants_bet_side ON bet_participants(bet_id, side);
```

### System Configuration
```sql
CREATE TABLE bet_system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    value_type ENUM('string', 'integer', 'boolean', 'json') DEFAULT 'string',
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_guild_specific BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Insert default configuration
INSERT INTO bet_system_config (key, value, value_type, description, category) VALUES
('currency_name', 'Sparks', 'string', 'Display name for currency', 'currency'),
('currency_emoji', '💫', 'string', 'Emoji representation', 'currency'),
('starting_balance', '100', 'integer', 'Initial balance for new users', 'currency'),
('daily_earn_cap', '25', 'integer', 'Maximum Sparks per day from engagement', 'earning'),
('earn_cooldown_seconds', '60', 'integer', 'Cooldown between earn events', 'earning'),
('qualify_min_length', '15', 'integer', 'Minimum message length to qualify', 'earning'),
('spam_threshold_messages', '6', 'integer', 'Messages in window before suppression', 'abuse'),
('spam_window_minutes', '10', 'integer', 'Time window for spam detection', 'abuse'),
('max_bet_amount', '1000', 'integer', 'Maximum amount for a single bet', 'betting'),
('min_bet_amount', '1', 'integer', 'Minimum amount for a single bet', 'betting'),
('default_bet_duration_hours', '24', 'integer', 'Default bet duration', 'betting'),
('max_bet_duration_hours', '168', 'integer', 'Maximum bet duration (1 week)', 'betting'),
('feature_enabled', 'true', 'boolean', 'Master feature flag', 'system');

CREATE TABLE bet_guild_config (
    guild_id VARCHAR(255) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, config_key)
);
```

## Engagement System Architecture

### Message Qualification Engine
```javascript
class MessageQualifier {
  static async qualifyMessage(message, context) {
    const criteria = {
      lengthCheck: message.content.length >= context.config.QUALIFY_MIN_LENGTH,
      hasAttachment: message.attachments.size > 0,
      hasReaction: false, // Checked asynchronously
      isBot: message.author.bot,
      isInNoXpChannel: context.config.NO_XP_CHANNEL_IDS.includes(message.channel.id)
    };
    
    // Initial qualification
    const qualifies = !criteria.isBot && 
                      !criteria.isInNoXpChannel && 
                      (criteria.lengthCheck || criteria.hasAttachment);
    
    if (!qualifies) return { qualifies: false, criteria };
    
    // Schedule reaction check for 10 minutes later
    if (!criteria.hasReaction) {
      setTimeout(() => this.checkReactionBonus(message, context), 10 * 60 * 1000);
    }
    
    return { qualifies: true, criteria };
  }
  
  static async checkReactionBonus(message, context) {
    // Check if message received reactions and award bonus
    const reactions = message.reactions.cache;
    if (reactions.size > 0) {
      await this.awardReactionBonus(message.author, context);
    }
  }
}
```

### Earning Calculation
```javascript
class EarningCalculator {
  static async calculateEarning(user, message, context) {
    const stats = await context.tables.BetEngagementStats.findOne({
      where: { user_id: user.id, guild_id: message.guild.id }
    });
    
    let earning = 0;
    const bonuses = [];
    
    // Base earning
    earning += 1;
    bonuses.push({ type: 'base_message', amount: 1 });
    
    // Daily participation bonus (first message of day)
    if (this.isFirstMessageToday(stats)) {
      earning += 2;
      bonuses.push({ type: 'daily_participation', amount: 2 });
    }
    
    // Thread engagement bonus
    const threadBonus = await this.calculateThreadBonus(message, context);
    if (threadBonus > 0) {
      earning += threadBonus;
      bonuses.push({ type: 'thread_engagement', amount: threadBonus });
    }
    
    // Apply daily cap
    const remainingCap = context.config.DAILY_EARN_CAP - (stats?.daily_earn_amount || 0);
    earning = Math.min(earning, remainingCap);
    
    return { earning, bonuses, cappedAmount: earning };
  }
  
  static async calculateThreadBonus(message, context) {
    // Count distinct users who replied in this thread in last hour
    const distinctRepliers = await this.countDistinctRepliers(message);
    const bonusMultiplier = Math.floor(distinctRepliers / 5);
    return Math.min(bonusMultiplier, 3); // Cap at +3 per day
  }
}
```

## Betting System Architecture

### Bet Creation Flow
```javascript
class BetManager {
  static async createBet(interaction, options, context) {
    const { amount, statement, ends, odds } = options;
    const user = await this.ensureUser(interaction.user, interaction.guild, context);
    
    // Validate user has sufficient balance
    const balance = await context.tables.BetBalances.findOne({ where: { user_id: user.id } });
    if (balance.current_balance < amount) {
      throw new Error(`Insufficient Sparks! You have ${balance.current_balance}, need ${amount}.`);
    }
    
    // Parse end time
    const closesAt = this.parseEndTime(ends || '24h');
    
    // Parse odds
    const [oddsFor, oddsAgainst] = this.parseOdds(odds || '1:1');
    
    // Create bet record
    const bet = await context.tables.BetWagers.create({
      guild_id: interaction.guild.id,
      channel_id: interaction.channel.id,
      opener_id: user.id,
      statement,
      odds_for: oddsFor,
      odds_against: oddsAgainst,
      opener_amount: amount,
      closes_at: closesAt,
      category: this.inferCategory(statement)
    });
    
    // Move opener's amount to escrow
    await this.moveToEscrow(user.id, amount, bet.id, 'bet_escrow_in', context);
    
    // Create and send interactive message
    const embed = await this.createBetEmbed(bet, context);
    const components = await this.createBetButtons(bet.id);
    
    const message = await interaction.editReply({ 
      embeds: [embed], 
      components: [components] 
    });
    
    // Store message ID for updates
    await bet.update({ message_id: message.id });
    
    return bet;
  }
  
  static parseEndTime(timeString) {
    // Handle relative times: "in 2h", "in 30m"
    const relativeMatch = timeString.match(/^in (\d+)([hmd])$/);
    if (relativeMatch) {
      const [, amount, unit] = relativeMatch;
      const multiplier = { h: 60, m: 1, d: 24 * 60 }[unit];
      return new Date(Date.now() + parseInt(amount) * multiplier * 60 * 1000);
    }
    
    // Handle natural language: "tomorrow 9pm"
    if (timeString.includes('tomorrow')) {
      // Use date parsing library like chrono-node
      return this.parseNaturalTime(timeString);
    }
    
    // Handle ISO format
    return new Date(timeString);
  }
}
```

### Settlement Engine
```javascript
class SettlementEngine {
  static async settleBet(betId, outcome, moderatorId, context) {
    const bet = await context.tables.BetWagers.findByPk(betId, {
      include: [
        { model: context.tables.BetParticipants, as: 'participants' },
        { model: context.tables.BetUsers, as: 'opener' }
      ]
    });
    
    if (!bet) throw new Error('Bet not found');
    if (bet.status !== 'open') throw new Error('Bet is not open for settlement');
    
    // Calculate payouts based on outcome and odds
    const payouts = await this.calculatePayouts(bet, outcome);
    
    // Execute payouts in transaction
    await context.sequelize.transaction(async (transaction) => {
      // Update bet status
      await bet.update({
        status: 'settled',
        outcome: outcome,
        settled_at: new Date()
      }, { transaction });
      
      // Process all payouts
      for (const payout of payouts) {
        await this.executePayout(payout, transaction, context);
      }
      
      // Update participant records with actual payouts
      for (const participant of bet.participants) {
        const payout = payouts.find(p => p.userId === participant.user_id);
        await participant.update({
          actual_payout: payout?.amount || 0
        }, { transaction });
      }
    });
    
    // Update Discord message
    await this.updateBetMessage(bet, 'settled', context);
    
    // Send settlement notification
    await this.sendSettlementNotification(bet, payouts, context);
    
    return { bet, payouts };
  }
  
  static async calculatePayouts(bet, outcome) {
    if (outcome === 'void') {
      // Void: return all money to participants
      return bet.participants.map(p => ({
        userId: p.user_id,
        amount: p.amount,
        type: 'refund'
      }));
    }
    
    const winners = bet.participants.filter(p => p.side === outcome);
    const losers = bet.participants.filter(p => p.side !== outcome);
    
    if (winners.length === 0) {
      // No winners, refund everyone
      return bet.participants.map(p => ({
        userId: p.user_id,
        amount: p.amount,
        type: 'refund'
      }));
    }
    
    // Calculate total pools
    const winnerPool = winners.reduce((sum, w) => sum + w.amount, 0);
    const loserPool = losers.reduce((sum, l) => sum + l.amount, 0);
    
    // Distribute winnings proportionally
    const payouts = [];
    
    for (const winner of winners) {
      const proportion = winner.amount / winnerPool;
      const winnings = Math.floor(loserPool * proportion);
      const totalPayout = winner.amount + winnings; // Stake + winnings
      
      payouts.push({
        userId: winner.user_id,
        amount: totalPayout,
        stake: winner.amount,
        winnings: winnings,
        type: 'payout'
      });
    }
    
    return payouts;
  }
}
```

## User Interface Design

### Discord Embed Layout
```javascript
class BetEmbedBuilder {
  static async createBetEmbed(bet, context) {
    const currency = context.config.CURRENCY_NAME;
    const emoji = context.config.CURRENCY_EMOJI;
    
    const embed = new EmbedBuilder()
      .setTitle(`🎲 Bet #${bet.id.slice(0, 8)}`)
      .setDescription(`**${bet.statement}**`)
      .setColor(this.getStatusColor(bet.status))
      .addFields([
        {
          name: '📊 Odds',
          value: `${bet.odds_for}:${bet.odds_against} (For:Against)`,
          inline: true
        },
        {
          name: '⏰ Closes',
          value: `<t:${Math.floor(bet.closes_at.getTime() / 1000)}:R>`,
          inline: true
        },
        {
          name: '💫 Status',
          value: this.getStatusText(bet.status),
          inline: true
        },
        {
          name: `${emoji} For Side`,
          value: `${bet.total_for_amount} ${currency}\n${this.getParticipantCount(bet, 'for')} participants`,
          inline: true
        },
        {
          name: `${emoji} Against Side`, 
          value: `${bet.total_against_amount} ${currency}\n${this.getParticipantCount(bet, 'against')} participants`,
          inline: true
        },
        {
          name: '🎯 Total Pool',
          value: `${bet.total_for_amount + bet.total_against_amount} ${currency}`,
          inline: true
        }
      ])
      .setFooter({ 
        text: `Opened by ${bet.opener.username} • ID: ${bet.id}`,
        iconURL: bet.opener.avatarURL
      })
      .setTimestamp(bet.created_at);
      
    if (bet.status === 'settled') {
      embed.addFields([{
        name: '🏆 Result',
        value: `**${bet.outcome.toUpperCase()}** wins!`,
        inline: false
      }]);
    }
    
    return embed;
  }
  
  static createBetButtons(betId, status = 'open') {
    const row = new ActionRowBuilder();
    
    if (status === 'open') {
      row.addComponents([
        new ButtonBuilder()
          .setCustomId(`bet_join_for_${betId}`)
          .setLabel('Join FOR')
          .setStyle(ButtonStyle.Success)
          .setEmoji('✅'),
        new ButtonBuilder()
          .setCustomId(`bet_join_against_${betId}`)
          .setLabel('Join AGAINST') 
          .setStyle(ButtonStyle.Danger)
          .setEmoji('❌'),
        new ButtonBuilder()
          .setCustomId(`bet_view_${betId}`)
          .setLabel('View Details')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('👁️'),
        new ButtonBuilder()
          .setCustomId(`bet_leave_${betId}`)
          .setLabel('Leave')
          .setStyle(ButtonStyle.Secondary)
          .setEmoji('🚪')
      ]);
    } else {
      // Bet closed - show disabled buttons
      row.addComponents([
        new ButtonBuilder()
          .setCustomId('disabled')
          .setLabel(`Bet ${status.toUpperCase()}`)
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      ]);
    }
    
    return row;
  }
}
```

### Modal Forms for Betting
```javascript
class BetModal {
  static createJoinModal(betId, side) {
    const modal = new ModalBuilder()
      .setCustomId(`bet_join_modal_${betId}_${side}`)
      .setTitle(`Join ${side.toUpperCase()} side`);
      
    const amountInput = new TextInputBuilder()
      .setCustomId('bet_amount')
      .setLabel(`How many Sparks do you want to bet?`)
      .setStyle(TextInputStyle.Short)
      .setPlaceholder('Enter amount (e.g., 25)')
      .setRequired(true)
      .setMinLength(1)
      .setMaxLength(10);
      
    const reasonInput = new TextInputBuilder()
      .setCustomId('bet_reason')
      .setLabel('Why do you think this side will win? (optional)')
      .setStyle(TextInputStyle.Paragraph)
      .setPlaceholder('Share your reasoning...')
      .setRequired(false)
      .setMaxLength(200);
      
    modal.addComponents([
      new ActionRowBuilder().addComponents(amountInput),
      new ActionRowBuilder().addComponents(reasonInput)
    ]);
    
    return modal;
  }
}
```

## Anti-Abuse & Security

### Spam Detection
```javascript
class SpamDetector {
  static async checkSpamScore(userId, guildId, context) {
    const stats = await context.tables.BetEngagementStats.findOne({
      where: { user_id: userId, guild_id: guildId }
    });
    
    if (!stats) return { isSpam: false, score: 0 };
    
    const now = new Date();
    const windowStart = new Date(now - 10 * 60 * 1000); // 10 minutes ago
    
    // Count qualifying messages in the last 10 minutes
    const recentCount = await this.countRecentMessages(userId, guildId, windowStart, context);
    
    // Check if user has reactions/replies to recent messages
    const engagementScore = await this.calculateEngagementScore(userId, guildId, windowStart, context);
    
    const spamScore = Math.max(0, recentCount - 6); // Over 6 messages = spam
    const isSpam = spamScore > 0 && engagementScore < 1; // No engagement
    
    if (isSpam) {
      await stats.update({
        spam_score: spamScore,
        spam_reset_at: new Date(now + 60 * 60 * 1000) // Reset in 1 hour
      });
    }
    
    return { isSpam, score: spamScore, engagementScore };
  }
}
```

### Rate Limiting
```javascript
class RateLimiter {
  static cooldowns = new Map(); // userId -> lastActionTime
  
  static checkCooldown(userId, actionType = 'earn') {
    const key = `${userId}_${actionType}`;
    const lastAction = this.cooldowns.get(key) || 0;
    const now = Date.now();
    const cooldownMs = this.getCooldownDuration(actionType) * 1000;
    
    if (now - lastAction < cooldownMs) {
      const remaining = Math.ceil((cooldownMs - (now - lastAction)) / 1000);
      return { allowed: false, remaining };
    }
    
    this.cooldowns.set(key, now);
    return { allowed: true, remaining: 0 };
  }
  
  static getCooldownDuration(actionType) {
    return {
      earn: 60,        // 60 seconds between earning events
      bet_create: 300, // 5 minutes between bet creations
      bet_join: 5      // 5 seconds between bet joins
    }[actionType] || 60;
  }
}
```

## Command Implementations

### `/bet open` Command Structure
```javascript
export default {
  data: new SlashCommandBuilder()
    .setName('bet')
    .setDescription('Betting system commands')
    .addSubcommand(subcommand =>
      subcommand
        .setName('open')
        .setDescription('Create a new bet')
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount to bet (Sparks)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000))
        .addStringOption(option =>
          option
            .setName('statement')
            .setDescription('What are you betting on?')
            .setRequired(true)
            .setMaxLength(200))
        .addStringOption(option =>
          option
            .setName('ends')
            .setDescription('When does this bet close? (e.g., "in 2h", "tomorrow 9pm")')
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('odds')
            .setDescription('Betting odds (e.g., "2:1", "1:3")')
            .setRequired(false))
        .addStringOption(option =>
          option
            .setName('category')
            .setDescription('Bet category')
            .setRequired(false)
            .addChoices(
              { name: '⚽ Sports', value: 'sports' },
              { name: '🌤️ Weather', value: 'weather' },
              { name: '🎬 Entertainment', value: 'entertainment' },
              { name: '🏘️ Community', value: 'community' },
              { name: '📈 Markets', value: 'markets' },
              { name: '🎮 Gaming', value: 'gaming' },
              { name: '🔬 Science', value: 'science' },
              { name: '🎭 Other', value: 'other' }
            )))
    .addSubcommand(subcommand =>
      subcommand
        .setName('join')
        .setDescription('Join an existing bet')
        .addStringOption(option =>
          option
            .setName('id')
            .setDescription('Bet ID to join')
            .setRequired(true))
        .addIntegerOption(option =>
          option
            .setName('amount')
            .setDescription('Amount to bet (Sparks)')
            .setRequired(true)
            .setMinValue(1)
            .setMaxValue(1000))
        .addStringOption(option =>
          option
            .setName('side')
            .setDescription('Which side to join')
            .setRequired(true)
            .addChoices(
              { name: 'For', value: 'for' },
              { name: 'Against', value: 'against' }
            )))
    // ... other subcommands
};
```

### Balance Command with Rich Display
```javascript
// /balance command implementation
async execute(interaction, context) {
  const targetUser = interaction.options.getUser('user') || interaction.user;
  const isModerator = await checkModeratorPermission(interaction.member, context);
  const isOwnBalance = targetUser.id === interaction.user.id;
  
  if (!isOwnBalance && !isModerator) {
    return await interaction.reply({
      content: '❌ You can only view your own balance!',
      ephemeral: true
    });
  }
  
  const user = await ensureBetUser(targetUser, interaction.guild, context);
  const balance = await context.tables.BetBalances.findOne({
    where: { user_id: user.id }
  });
  
  const recentTransactions = await context.tables.BetLedger.findAll({
    where: { user_id: user.id },
    order: [['created_at', 'DESC']],
    limit: 5
  });
  
  const embed = new EmbedBuilder()
    .setTitle(`💳 ${targetUser.username}'s Balance`)
    .setThumbnail(targetUser.avatarURL())
    .addFields([
      {
        name: '💫 Available Sparks',
        value: `**${balance.current_balance}** Sparks`,
        inline: true
      },
      {
        name: '🔒 In Escrow',
        value: `${balance.escrow_balance} Sparks`,
        inline: true
      },
      {
        name: '📊 Total Value',
        value: `${balance.current_balance + balance.escrow_balance} Sparks`,
        inline: true
      },
      {
        name: '📈 Lifetime Stats',
        value: `Earned: ${balance.lifetime_earned}\nSpent: ${balance.lifetime_spent}\nNet: ${balance.lifetime_earned - balance.lifetime_spent}`,
        inline: true
      },
      {
        name: '🎲 Betting Stats',
        value: `Created: ${balance.total_bets_created}\nJoined: ${balance.total_bets_joined}\nWinnings: ${balance.total_winnings}`,
        inline: true
      },
      {
        name: '⏱️ Recent Activity',
        value: recentTransactions.length > 0 
          ? recentTransactions.map(t => 
              `${this.getTransactionEmoji(t.transaction_type)} ${t.amount > 0 ? '+' : ''}${t.amount} - ${this.getTransactionDescription(t)}`
            ).join('\n')
          : 'No recent activity',
        inline: false
      }
    ])
    .setFooter({ text: `User ID: ${user.id}` })
    .setTimestamp()
    .setColor(0x00FF88);
    
  await interaction.reply({
    embeds: [embed],
    ephemeral: !isModerator || isOwnBalance
  });
}
```

## Configuration System

### Environment Variables
```bash
# Currency Configuration
CURRENCY_NAME=Sparks
CURRENCY_EMOJI=💫
STARTING_BALANCE=100

# Earning System
DAILY_EARN_CAP=25
EARN_COOLDOWN_SECONDS=60
QUALIFY_MIN_LENGTH=15
MAX_DAILY_EARN_EVENTS=15

# Betting Limits
MIN_BET_AMOUNT=1
MAX_BET_AMOUNT=1000
DEFAULT_BET_DURATION_HOURS=24
MAX_BET_DURATION_HOURS=168

# Anti-Abuse
SPAM_THRESHOLD_MESSAGES=6
SPAM_WINDOW_MINUTES=10

# Permissions
BET_MOD_ROLE_IDS=["123456789", "987654321"]
NO_XP_CHANNEL_IDS=["111111111", "222222222"]

# Features
BETS_ENABLED=true
EARNING_ENABLED=true
```

### Guild-Specific Configuration
```javascript
class ConfigManager {
  static async getGuildConfig(guildId, key, context) {
    // Check guild-specific config first
    const guildConfig = await context.tables.BetGuildConfig.findOne({
      where: { guild_id: guildId, config_key: key }
    });
    
    if (guildConfig) {
      return this.parseConfigValue(guildConfig.value, key);
    }
    
    // Fall back to system default
    const systemConfig = await context.tables.BetSystemConfig.findByPk(key);
    return systemConfig ? this.parseConfigValue(systemConfig.value, key) : null;
  }
  
  static async setGuildConfig(guildId, key, value, context) {
    await context.tables.BetGuildConfig.upsert({
      guild_id: guildId,
      config_key: key,
      value: String(value)
    });
  }
}
```

## Testing Strategy

### Unit Tests Structure
```javascript
// Example test file: bet-system.test.js
describe('Bet System', () => {
  describe('Earning System', () => {
    test('should award base earning for qualifying message', async () => {
      const user = await createTestUser();
      const message = createMockMessage({ content: 'This is a qualifying message that is long enough' });
      
      const result = await EarningCalculator.calculateEarning(user, message, mockContext);
      
      expect(result.earning).toBe(1);
      expect(result.bonuses).toContainEqual({ type: 'base_message', amount: 1 });
    });
    
    test('should apply daily participation bonus for first message', async () => {
      const user = await createTestUser();
      const message = createMockMessage({ isFirstToday: true });
      
      const result = await EarningCalculator.calculateEarning(user, message, mockContext);
      
      expect(result.earning).toBe(3); // 1 base + 2 daily
      expect(result.bonuses).toContainEqual({ type: 'daily_participation', amount: 2 });
    });
    
    test('should respect daily earning cap', async () => {
      const user = await createTestUser({ dailyEarnAmount: 24 }); // Near cap
      const message = createMockMessage({ content: 'qualifying message' });
      
      const result = await EarningCalculator.calculateEarning(user, message, mockContext);
      
      expect(result.earning).toBe(1); // Should be capped
    });
  });
  
  describe('Betting System', () => {
    test('should create bet and move amount to escrow', async () => {
      const user = await createTestUser({ balance: 100 });
      const betOptions = {
        amount: 50,
        statement: 'It will rain tomorrow',
        ends: 'in 24h',
        odds: '1:1'
      };
      
      const bet = await BetManager.createBet(mockInteraction, betOptions, mockContext);
      
      expect(bet).toBeDefined();
      expect(bet.statement).toBe(betOptions.statement);
      
      const updatedBalance = await getBalance(user.id);
      expect(updatedBalance.current_balance).toBe(50);
      expect(updatedBalance.escrow_balance).toBe(50);
    });
    
    test('should calculate payouts correctly for 1:1 odds', async () => {
      const bet = await createTestBet({
        odds_for: 1,
        odds_against: 1,
        participants: [
          { side: 'for', amount: 30 },
          { side: 'for', amount: 20 },
          { side: 'against', amount: 50 }
        ]
      });
      
      const payouts = await SettlementEngine.calculatePayouts(bet, 'for');
      
      expect(payouts).toHaveLength(2);
      expect(payouts[0].amount).toBe(60); // 30 stake + 30 winnings
      expect(payouts[1].amount).toBe(40); // 20 stake + 20 winnings
    });
  });
});
```

## Migration Scripts

### Initial Database Setup
```sql
-- Migration: 20250103000000-create-bet-system-tables.sql

BEGIN;

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- User management
CREATE TABLE bet_users (
    id BIGSERIAL PRIMARY KEY,
    discord_id VARCHAR(255) NOT NULL,
    guild_id VARCHAR(255) NOT NULL,
    username VARCHAR(255),
    discriminator VARCHAR(10),
    hide_last_seen BOOLEAN DEFAULT FALSE,
    privacy_level VARCHAR(20) DEFAULT 'open' CHECK (privacy_level IN ('open', 'friends', 'private')),
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_user_guild UNIQUE(discord_id, guild_id)
);

-- Balance tracking
CREATE TABLE bet_balances (
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE PRIMARY KEY,
    current_balance INTEGER DEFAULT 100 CHECK (current_balance >= 0),
    escrow_balance INTEGER DEFAULT 0 CHECK (escrow_balance >= 0),
    lifetime_earned INTEGER DEFAULT 100,
    lifetime_spent INTEGER DEFAULT 0,
    total_bets_created INTEGER DEFAULT 0,
    total_bets_joined INTEGER DEFAULT 0,
    total_winnings INTEGER DEFAULT 0,
    total_losses INTEGER DEFAULT 0,
    updated_at TIMESTAMP DEFAULT NOW()
);

-- Transaction ledger
CREATE TYPE transaction_type AS ENUM (
    'initial_grant', 'earn_message', 'earn_participation', 'earn_thread', 'earn_reaction',
    'bet_escrow_in', 'bet_escrow_out', 'bet_payout', 'bet_refund',
    'admin_adjustment', 'penalty'
);

CREATE TABLE bet_ledger (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    transaction_type transaction_type NOT NULL,
    amount INTEGER NOT NULL,
    running_balance INTEGER NOT NULL,
    reference_type VARCHAR(50),
    reference_id VARCHAR(255),
    metadata JSONB,
    created_at TIMESTAMP DEFAULT NOW()
);

-- Engagement stats
CREATE TABLE bet_engagement_stats (
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    guild_id VARCHAR(255) NOT NULL,
    message_count INTEGER DEFAULT 0,
    qualifying_message_count INTEGER DEFAULT 0,
    last_message_at TIMESTAMP,
    last_message_channel_id VARCHAR(255),
    daily_earn_count INTEGER DEFAULT 0,
    daily_earn_amount INTEGER DEFAULT 0,
    last_earn_at TIMESTAMP,
    last_earn_reset DATE DEFAULT CURRENT_DATE,
    consecutive_days INTEGER DEFAULT 0,
    longest_streak INTEGER DEFAULT 0,
    spam_score INTEGER DEFAULT 0,
    spam_reset_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (user_id, guild_id)
);

-- Betting system
CREATE TYPE bet_status AS ENUM ('open', 'closed', 'settled', 'voided', 'cancelled');
CREATE TYPE bet_outcome AS ENUM ('for', 'against', 'void');
CREATE TYPE bet_side AS ENUM ('for', 'against');

CREATE TABLE bet_wagers (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    guild_id VARCHAR(255) NOT NULL,
    channel_id VARCHAR(255) NOT NULL,
    message_id VARCHAR(255),
    opener_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    statement TEXT NOT NULL CHECK (LENGTH(statement) BETWEEN 10 AND 500),
    description TEXT,
    odds_for INTEGER DEFAULT 1 CHECK (odds_for BETWEEN 1 AND 10),
    odds_against INTEGER DEFAULT 1 CHECK (odds_against BETWEEN 1 AND 10),
    opener_amount INTEGER NOT NULL CHECK (opener_amount > 0),
    total_for_amount INTEGER DEFAULT 0,
    total_against_amount INTEGER DEFAULT 0,
    status bet_status DEFAULT 'open',
    opens_at TIMESTAMP DEFAULT NOW(),
    closes_at TIMESTAMP NOT NULL,
    settled_at TIMESTAMP,
    outcome bet_outcome,
    category VARCHAR(50),
    tags TEXT[],
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT valid_close_time CHECK (closes_at > opens_at),
    CONSTRAINT settled_has_outcome CHECK (status != 'settled' OR outcome IS NOT NULL),
    CONSTRAINT settled_has_time CHECK (status != 'settled' OR settled_at IS NOT NULL)
);

CREATE TABLE bet_participants (
    id BIGSERIAL PRIMARY KEY,
    bet_id UUID REFERENCES bet_wagers(id) ON DELETE CASCADE,
    user_id BIGINT REFERENCES bet_users(id) ON DELETE CASCADE,
    side bet_side NOT NULL,
    amount INTEGER NOT NULL CHECK (amount > 0),
    potential_payout INTEGER,
    actual_payout INTEGER,
    joined_at TIMESTAMP DEFAULT NOW(),
    CONSTRAINT unique_bet_user_side UNIQUE(bet_id, user_id, side)
);

-- System configuration
CREATE TYPE config_value_type AS ENUM ('string', 'integer', 'boolean', 'json');

CREATE TABLE bet_system_config (
    key VARCHAR(255) PRIMARY KEY,
    value TEXT NOT NULL,
    value_type config_value_type DEFAULT 'string',
    description TEXT,
    category VARCHAR(50) DEFAULT 'general',
    is_guild_specific BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE bet_guild_config (
    guild_id VARCHAR(255) NOT NULL,
    config_key VARCHAR(255) NOT NULL,
    value TEXT NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    PRIMARY KEY (guild_id, config_key)
);

-- Indexes
CREATE INDEX idx_bet_users_discord_guild ON bet_users(discord_id, guild_id);
CREATE INDEX idx_bet_users_guild ON bet_users(guild_id);
CREATE INDEX idx_ledger_user_created ON bet_ledger(user_id, created_at);
CREATE INDEX idx_ledger_type ON bet_ledger(transaction_type);
CREATE INDEX idx_ledger_reference ON bet_ledger(reference_type, reference_id);
CREATE INDEX idx_engagement_last_message ON bet_engagement_stats(last_message_at);
CREATE INDEX idx_engagement_daily_reset ON bet_engagement_stats(last_earn_reset);
CREATE INDEX idx_wagers_status ON bet_wagers(status);
CREATE INDEX idx_wagers_closes_at ON bet_wagers(closes_at);
CREATE INDEX idx_wagers_guild ON bet_wagers(guild_id);
CREATE INDEX idx_wagers_category ON bet_wagers(category);
CREATE INDEX idx_wagers_opener ON bet_wagers(opener_id);
CREATE INDEX idx_participants_bet ON bet_participants(bet_id);
CREATE INDEX idx_participants_user ON bet_participants(user_id);
CREATE INDEX idx_participants_bet_side ON bet_participants(bet_id, side);

-- Insert default configuration
INSERT INTO bet_system_config (key, value, value_type, description, category) VALUES
('currency_name', 'Sparks', 'string', 'Display name for currency', 'currency'),
('currency_emoji', '💫', 'string', 'Emoji representation', 'currency'),
('starting_balance', '100', 'integer', 'Initial balance for new users', 'currency'),
('daily_earn_cap', '25', 'integer', 'Maximum Sparks per day from engagement', 'earning'),
('earn_cooldown_seconds', '60', 'integer', 'Cooldown between earn events', 'earning'),
('qualify_min_length', '15', 'integer', 'Minimum message length to qualify', 'earning'),
('spam_threshold_messages', '6', 'integer', 'Messages in window before suppression', 'abuse'),
('spam_window_minutes', '10', 'integer', 'Time window for spam detection', 'abuse'),
('max_bet_amount', '1000', 'integer', 'Maximum amount for a single bet', 'betting'),
('min_bet_amount', '1', 'integer', 'Minimum amount for a single bet', 'betting'),
('default_bet_duration_hours', '24', 'integer', 'Default bet duration', 'betting'),
('max_bet_duration_hours', '168', 'integer', 'Maximum bet duration (1 week)', 'betting'),
('feature_enabled', 'true', 'boolean', 'Master feature flag', 'system');

COMMIT;
```

## Performance Considerations

### Database Optimization
- **Proper indexing** on frequently queried columns
- **Partitioning** of ledger table by date for historical data
- **Materialized views** for complex balance calculations
- **Connection pooling** for high-concurrency scenarios

### Caching Strategy
- **Redis cache** for frequently accessed data (balances, recent transactions)
- **In-memory cache** for configuration values
- **Discord message cache** for bet embeds to reduce API calls

### Rate Limiting & Scaling
- **Database connection limits** to prevent overload
- **API rate limiting** per user for command usage
- **Background job processing** for non-critical tasks
- **Horizontal scaling** considerations for multi-server deployment

---

This comprehensive design provides a complete blueprint for implementing the `/bet` system with engagement-based currency, covering all aspects from database schema to user experience flows, anti-abuse measures, and performance optimization.