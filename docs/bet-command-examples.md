# Bet System Command Help Examples

## Command Syntax Reference

### `/bet help`
**Output:**
```
💫 **Betting System Commands**

**Creating Bets:**
• `/bet open 50 "Statement" ends:2h` - Open bet, escrow 50 Sparks, closes in 2 hours
• `/bet open 25 "Statement" odds:2:1` - Open bet with 2:1 odds favoring "for" side
• `/bet open 100 "Weather tomorrow" category:weather` - Categorized bet

**Participating:**
• `/bet join abc123 30 side:for` - Join bet #abc123 with 30 Sparks on FOR side
• `/bet join def456 15 side:against` - Join bet #def456 with 15 Sparks on AGAINST side

**Viewing & Management:**
• `/bet list open` - View all open bets in this server
• `/bet list my` - View your active bet participations
• `/bet list recent` - View recently settled bets
• `/bet view abc123` - View detailed info for bet #abc123

**Administration (Moderators Only):**
• `/bet settle abc123 for` - Settle bet with FOR side winning
• `/bet settle abc123 against` - Settle bet with AGAINST side winning
• `/bet settle abc123 void` - Void bet and refund all participants
• `/bet cancel abc123` - Cancel bet (only if no participants joined)

**Utilities:**
• `/balance` - Check your Spark balance and transaction history
• `/balance @user` - Check another user's balance (moderators only)
• `/lastseen @user` - See when user was last active

**Time Formats:**
• **Relative:** `in 2h`, `in 30m`, `in 3d`
• **Natural:** `tomorrow 9pm`, `next friday`, `in 2 weeks`
• **ISO Format:** `2024-01-15T15:30:00`

**Categories:** sports, weather, entertainment, community, markets, gaming, science, other

💡 **Tips:**
- Your first message each day earns a +2 Spark bonus!
- Active participation in threads can earn bonus Sparks
- Messages with reactions earn additional rewards
- Daily earning cap: 25 Sparks from engagement
```

## Detailed Command Examples

### Creating Bets

#### Basic Bet Creation
```
Command: /bet open amount:50 statement:"It will rain in NYC tomorrow"
Response: 
🎲 Bet #a1b2c3d4 created!
💫 Escrowed 50 Sparks
⏰ Closes tomorrow at 12:00 PM EST
🎯 Odds: 1:1 (Even)

[Join For] [Join Against] [View Details] [Leave]
```

#### Bet with Custom Odds
```
Command: /bet open amount:75 statement:"My team will win the championship" odds:3:1 ends:"in 2 weeks"
Response:
🎲 Bet #e5f6g7h8 created!
💫 Escrowed 75 Sparks  
⏰ Closes in 2 weeks (Jan 28, 2024 at 3:45 PM EST)
🎯 Odds: 3:1 (Favors FOR side)
📁 Category: Sports

[Join For] [Join Against] [View Details] [Leave]
```

#### Weather Bet with Category
```
Command: /bet open amount:25 statement:"Temperature will exceed 80°F today" category:weather ends:"in 12h"
Response:
🎲 Bet #i9j0k1l2 created!
💫 Escrowed 25 Sparks
⏰ Closes in 12 hours (today at 11:45 PM EST)  
🎯 Odds: 1:1 (Even)
📁 Category: 🌤️ Weather

[Join For] [Join Against] [View Details] [Leave]
```

### Joining Bets

#### Joining FOR Side
```
Command: /bet join id:a1b2c3d4 amount:30 side:for
Response:
✅ You joined **FOR** on Bet #a1b2c3d4 with 30 Sparks!

**Bet:** "It will rain in NYC tomorrow"
**Your Side:** FOR (supporting the statement)
**Your Stake:** 30 💫 Sparks
**Potential Payout:** 60 💫 Sparks (30 stake + 30 winnings)
**Total FOR Side:** 80 💫 Sparks
```

#### Joining AGAINST Side
```
Command: /bet join id:e5f6g7h8 amount:45 side:against  
Response:
❌ You joined **AGAINST** on Bet #e5f6g7h8 with 45 Sparks!

**Bet:** "My team will win the championship"
**Your Side:** AGAINST (opposing the statement)
**Your Stake:** 45 💫 Sparks
**Potential Payout:** 60 💫 Sparks (45 stake + 15 winnings at 3:1 odds)
**Total AGAINST Side:** 120 💫 Sparks
```

### Viewing Bets

#### Bet Detail View
```
Command: /bet view id:a1b2c3d4
Response:
🎲 **Bet #a1b2c3d4 Details**

**Statement:** "It will rain in NYC tomorrow"
**Status:** 🟢 Open
**Closes:** <t:1704567600:R> (tomorrow at 12:00 PM EST)
**Category:** 🌤️ Weather
**Odds:** 1:1 (Even)

**💫 Betting Pool:**
• **FOR Side:** 80 Sparks (2 participants)
  - @opener: 50 Sparks
  - @user123: 30 Sparks
• **AGAINST Side:** 0 Sparks (0 participants)

**🎯 Total Pool:** 80 💫 Sparks
**📊 Payout Preview:** 
- If FOR wins: Each FOR participant gets their stake + proportional share of 0 AGAINST pool
- If AGAINST wins: N/A (no AGAINST participants)

**🏷️ Bet ID:** a1b2c3d4
**👤 Opened by:** @opener • Jan 14, 2024 at 11:45 AM
```

#### Open Bets List
```
Command: /bet list open
Response:
🎲 **Open Bets in This Server**

**#a1b2c3d4** • 🌤️ Weather • <t:1704567600:R>
"It will rain in NYC tomorrow"
💫 Pool: 80 Sparks (FOR: 80, AGAINST: 0)

**#e5f6g7h8** • ⚽ Sports • <t:1705276800:R>  
"My team will win the championship"
💫 Pool: 195 Sparks (FOR: 75, AGAINST: 120)

**#i9j0k1l2** • 🌤️ Weather • <t:1704525600:R>
"Temperature will exceed 80°F today"  
💫 Pool: 25 Sparks (FOR: 25, AGAINST: 0)

💡 Use `/bet view <id>` for details or click buttons to join!
```

#### User's Active Bets
```
Command: /bet list my
Response:
💫 **Your Active Bets**

**Bets You Created:**
🎲 #a1b2c3d4 • 🌤️ Weather • <t:1704567600:R>
"It will rain in NYC tomorrow" 
Your stake: 50 Sparks (FOR side)

**Bets You Joined:**
🎲 #e5f6g7h8 • ⚽ Sports • <t:1705276800:R>
"My team will win the championship"
Your stake: 45 Sparks (AGAINST side)

**📊 Summary:**
• Total at risk: 95 💫 Sparks  
• Potential winnings: 75 💫 Sparks
• Active bets: 2
```

### Balance Management

#### Personal Balance Check
```
Command: /balance
Response (Ephemeral):
💳 **Your Balance Summary**

💫 **Available:** 175 Sparks
🔒 **In Escrow:** 95 Sparks  
📊 **Total Value:** 270 Sparks

**📈 Lifetime Stats:**
• Earned: 425 Sparks
• Spent: 250 Sparks  
• Net: +175 Sparks

**🎲 Betting Record:**
• Bets Created: 3
• Bets Joined: 7
• Total Winnings: 125 Sparks
• Win Rate: 60%

**⏱️ Recent Activity:**
💫 +1 - Message earning (5 minutes ago)
🎲 -45 - Joined bet #e5f6g7h8 (AGAINST) (1 hour ago)
💫 +2 - Daily participation bonus (3 hours ago)  
🎲 +75 - Won bet #xyz789 (yesterday)
💫 +1 - Thread engagement bonus (yesterday)

🏷️ User ID: 12345 • Member since: Dec 15, 2023
```

#### Moderator Balance Check
```
Command: /balance user:@someone
Response:
💳 **@someone's Balance**

💫 **Available:** 85 Sparks
🔒 **In Escrow:** 30 Sparks
📊 **Total Value:** 115 Sparks

**📈 Lifetime Stats:**
• Earned: 200 Sparks
• Spent: 115 Sparks
• Net: +85 Sparks

**🎲 Betting Summary:**
• Bets Created: 1
• Bets Joined: 4  
• Win Rate: 25%

**Recent Activity:** [Redacted for Privacy]

🏷️ User ID: 67890 • Member since: Jan 5, 2024
```

### Social Features

#### Last Seen Check
```
Command: /lastseen user:@someone
Response:
👀 **@someone last seen:**
3 hours ago in #general
<t:1704556800:F> (Jan 14, 2024 at 8:45 AM EST)

💬 Last message: "That's a great point about..."
```

#### Last Seen - Privacy Protected
```
Command: /lastseen user:@private_user  
Response:
👀 **@private_user last activity:**
❌ Unavailable (user privacy settings)

💡 This user has chosen to hide their activity status.
```

### Settlement Examples

#### Successful Settlement
```
Command: /bet settle id:a1b2c3d4 outcome:for
Response:
🏆 **Bet #a1b2c3d4 Settled: FOR Wins!**

**Statement:** "It will rain in NYC tomorrow"
**Final Result:** FOR side victory
**Settlement Time:** <t:1704567600:F>

**💰 Payouts Distributed:**
• @opener: 50 💫 Sparks (stake returned - no opposing bets)
• @user123: 30 💫 Sparks (stake returned - no opposing bets)

**📊 Final Pool:** 80 💫 Sparks total
**⚖️ Outcome:** All participants receive stakes back (no opposition)

✅ All payouts completed successfully!
```

#### Settlement with Winnings
```
Command: /bet settle id:e5f6g7h8 outcome:against
Response: 
🏆 **Bet #e5f6g7h8 Settled: AGAINST Wins!**

**Statement:** "My team will win the championship"  
**Final Result:** AGAINST side victory
**Settlement Time:** <t:1705276800:F>

**💰 Payouts Distributed:**
**Winners (AGAINST side):**
• @user456: 120 💫 (45 stake + 75 winnings)
• @user789: 100 💫 (45 stake + 55 winnings)

**Losers (FOR side):**
• @opener: 0 💫 (lost 75 Sparks)

**📊 Final Pool:** 165 💫 Sparks
• FOR side: 75 Sparks (lost)
• AGAINST side: 90 Sparks (stake) + 75 Sparks (winnings)

✅ All payouts completed successfully!
```

#### Voided Bet
```
Command: /bet settle id:i9j0k1l2 outcome:void
Response:
🚫 **Bet #i9j0k1l2 Voided**

**Statement:** "Temperature will exceed 80°F today"
**Reason:** Insufficient data / Technical issue
**Void Time:** <t:1704525600:F>

**💰 Refunds Processed:**
• @opener: 25 💫 Sparks (full refund)

**📊 Total Refunded:** 25 💫 Sparks
**⚖️ Result:** All participants receive full stake refunds

✅ All refunds completed successfully!
```

## Error Messages

### Insufficient Funds
```
❌ **Insufficient Sparks!**

You have **45** 💫 Sparks available, but need **50** 💫 Sparks for this bet.

**💡 Your Current Balance:**
• Available: 45 💫 Sparks
• In Escrow: 25 💫 Sparks  
• Total: 70 💫 Sparks

**💫 Ways to Earn More:**
• Post engaging messages (up to 25 per day)
• Participate in conversations  
• Win existing bets: `/bet list my`
```

### Bet Already Closed
```
❌ **Bet Closed**

Bet #a1b2c3d4 closed on Jan 15, 2024 at 12:00 PM EST.

**Final Status:** Settled (FOR wins)
**Your Participation:** Not joined

💡 Check `/bet list open` for active bets!
```

### Invalid Time Format
```
❌ **Invalid Time Format**

Could not parse "next tuesday maybe".

**✅ Valid Formats:**
• **Relative:** `in 2h`, `in 30m`, `in 5d`
• **Natural:** `tomorrow 9pm`, `next friday 2pm`
• **ISO Format:** `2024-01-15T15:30:00`

**Examples:**
• `in 4 hours` ✅
• `tomorrow` ✅  
• `jan 20 3pm` ✅
• `sometime soon` ❌
```

### Rate Limit Hit
```
⏰ **Cool Down Active**

You can create another bet in **3 minutes 15 seconds**.

**Rate Limits:**
• Bet creation: 1 every 5 minutes
• Joining bets: 1 every 5 seconds  
• Balance checks: Unlimited

💡 Use this time to research your next bet!
```

### Duplicate Join Attempt  
```
❌ **Already Joined**

You've already joined the **AGAINST** side of bet #e5f6g7h8.

**Your Current Stake:** 45 💫 Sparks on AGAINST side
**Bet Status:** Still open until <t:1705276800:R>

💡 You can only join each side once per bet.
```

## Interactive Button Responses

### Join For Button Click
```
[Modal appears with:]

**Join FOR Side**
Bet: "It will rain in NYC tomorrow"

Amount to bet: [Text Input: "Enter Sparks (1-500)"]
Reason (optional): [Text Input: "Why do you think FOR will win?"]

[Cancel] [Submit]
```

### Join Against Button Click  
```
[Modal appears with:]

**Join AGAINST Side** 
Bet: "My team will win the championship"

Amount to bet: [Text Input: "Enter Sparks (1-500)"]
Reason (optional): [Text Input: "Why do you think AGAINST will win?"]

[Cancel] [Submit]
```

### View Details Button
```
[Shows expanded bet information similar to /bet view command]
```

### Leave Button (for bet creator)
```
❌ **Cannot Leave**

As the bet creator, you cannot leave this bet. 

**Options:**
• **Cancel** the bet if no one else has joined: `/bet cancel a1b2c3d4`  
• **Wait** for settlement if others have joined

💡 Only participants (not creators) can leave before settlement.
```