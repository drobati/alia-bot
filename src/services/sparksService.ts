import { Message } from 'discord.js';
import { Context } from '../utils/types';

// Configuration constants
const STARTING_BALANCE = 100;
const DAILY_SPARK_CAP = 25;
const DAILY_EARN_EVENT_CAP = 15;
const EARN_COOLDOWN_SECONDS = 60;
const MIN_MESSAGE_LENGTH = 15;
const SPAM_MESSAGE_THRESHOLD = 6;
const SPAM_WINDOW_MINUTES = 10;
const DAILY_BONUS_SPARKS = 2;

interface EarnResult {
    earned: boolean;
    amount: number;
    reason: string;
    isFirstOfDay?: boolean;
}

interface BalanceInfo {
    currentBalance: number;
    escrowBalance: number;
    lifetimeEarned: number;
    lifetimeSpent: number;
    availableBalance: number;
}

interface TransactionRecord {
    type: string;
    amount: number;
    description: string | null;
    createdAt: Date;
}

export class SparksService {
    private context: Context;

    constructor(context: Context) {
        this.context = context;
    }

    /**
     * Get or create a user in the sparks system
     */
    async getOrCreateUser(guildId: string, discordId: string, username?: string): Promise<any> {
        const { tables } = this.context;

        let user = await tables.SparksUser.findOne({
            where: { guild_id: guildId, discord_id: discordId },
        });

        if (!user) {
            // Create new user
            user = await tables.SparksUser.create({
                guild_id: guildId,
                discord_id: discordId,
                username: username || null,
            });

            // Create balance record with starting balance
            await tables.SparksBalance.create({
                user_id: user.id,
                current_balance: STARTING_BALANCE,
                lifetime_earned: STARTING_BALANCE,
            });

            // Create engagement tracking record
            const today = new Date().toISOString().split('T')[0];
            await tables.SparksEngagement.create({
                user_id: user.id,
                reset_date: today,
            });

            // Log the initial balance in ledger
            await tables.SparksLedger.create({
                user_id: user.id,
                type: 'earn',
                amount: STARTING_BALANCE,
                ref_type: 'signup_bonus',
                description: 'Welcome bonus',
            });

            this.context.log.info({
                category: 'sparks',
                action: 'user_created',
                guildId,
                discordId,
                startingBalance: STARTING_BALANCE,
            }, 'New Sparks user created');
        } else if (username && user.username !== username) {
            // Update username if changed
            await user.update({ username });
        }

        return user;
    }

    /**
     * Get user's balance information
     */
    async getBalance(guildId: string, discordId: string): Promise<BalanceInfo | null> {
        const { tables } = this.context;

        const user = await tables.SparksUser.findOne({
            where: { guild_id: guildId, discord_id: discordId },
        });

        if (!user) {
            return null;
        }

        const balance = await tables.SparksBalance.findOne({
            where: { user_id: user.id },
        });

        if (!balance) {
            return null;
        }

        return {
            currentBalance: balance.current_balance,
            escrowBalance: balance.escrow_balance,
            lifetimeEarned: balance.lifetime_earned,
            lifetimeSpent: balance.lifetime_spent,
            availableBalance: balance.current_balance - balance.escrow_balance,
        };
    }

    /**
     * Get recent transactions for a user
     */
    async getRecentTransactions(guildId: string, discordId: string, limit = 5): Promise<TransactionRecord[]> {
        const { tables } = this.context;

        const user = await tables.SparksUser.findOne({
            where: { guild_id: guildId, discord_id: discordId },
        });

        if (!user) {
            return [];
        }

        const transactions = await tables.SparksLedger.findAll({
            where: { user_id: user.id },
            order: [['created_at', 'DESC']],
            limit,
        });

        return transactions.map((t: any) => ({
            type: t.type,
            amount: t.amount,
            description: t.description,
            createdAt: t.created_at,
        }));
    }

    /**
     * Check if a message qualifies for earning sparks
     */
    isQualifyingMessage(message: Message): boolean {
        // Must have minimum length OR have an attachment
        if (message.content.length >= MIN_MESSAGE_LENGTH) {
            return true;
        }

        if (message.attachments.size > 0) {
            return true;
        }

        return false;
    }

    /**
     * Process a message for potential spark earning
     */
    async processMessage(message: Message): Promise<EarnResult> {
        const { tables, log } = this.context;

        // Skip bot messages
        if (message.author.bot) {
            return { earned: false, amount: 0, reason: 'bot_message' };
        }

        // Skip DMs
        if (!message.guild) {
            return { earned: false, amount: 0, reason: 'dm_message' };
        }

        const guildId = message.guild.id;
        const discordId = message.author.id;
        const username = message.author.username;

        // Check if message qualifies
        if (!this.isQualifyingMessage(message)) {
            return { earned: false, amount: 0, reason: 'message_too_short' };
        }

        try {
            // Get or create user
            const user = await this.getOrCreateUser(guildId, discordId, username);

            // Update last seen
            await user.update({
                last_seen_at: new Date(),
                last_seen_channel_id: message.channel.id,
            });

            // Get engagement stats
            let engagement = await tables.SparksEngagement.findOne({
                where: { user_id: user.id },
            });

            if (!engagement) {
                const today = new Date().toISOString().split('T')[0];
                engagement = await tables.SparksEngagement.create({
                    user_id: user.id,
                    reset_date: today,
                });
            }

            // Reset daily counters if needed
            const today = new Date().toISOString().split('T')[0];
            if (engagement.reset_date !== today) {
                await engagement.update({
                    daily_earn_count: 0,
                    daily_sparks_earned: 0,
                    reset_date: today,
                    recent_message_count: 0,
                    recent_message_window_start: null,
                    suppressed_until: null,
                });
            }

            // Check if suppressed
            if (engagement.suppressed_until && new Date() < new Date(engagement.suppressed_until)) {
                return { earned: false, amount: 0, reason: 'suppressed' };
            }

            // Check daily cap
            if (engagement.daily_sparks_earned >= DAILY_SPARK_CAP) {
                return { earned: false, amount: 0, reason: 'daily_cap_reached' };
            }

            // Check earn event cap
            if (engagement.daily_earn_count >= DAILY_EARN_EVENT_CAP) {
                return { earned: false, amount: 0, reason: 'earn_event_cap_reached' };
            }

            // Check cooldown
            if (engagement.last_earn_at) {
                const lastEarn = new Date(engagement.last_earn_at);
                const cooldownEnd = new Date(lastEarn.getTime() + EARN_COOLDOWN_SECONDS * 1000);
                if (new Date() < cooldownEnd) {
                    return { earned: false, amount: 0, reason: 'cooldown' };
                }
            }

            // Spam detection - track recent messages
            const now = new Date();
            let recentCount = engagement.recent_message_count || 0;
            let windowStart = engagement.recent_message_window_start
                ? new Date(engagement.recent_message_window_start)
                : now;

            // Reset window if older than 10 minutes
            if (now.getTime() - windowStart.getTime() > SPAM_WINDOW_MINUTES * 60 * 1000) {
                recentCount = 0;
                windowStart = now;
            }

            recentCount++;

            // Check for spam
            if (recentCount > SPAM_MESSAGE_THRESHOLD) {
                // Suppress until next hour
                const nextHour = new Date();
                nextHour.setMinutes(0, 0, 0);
                nextHour.setHours(nextHour.getHours() + 1);

                await engagement.update({
                    suppressed_until: nextHour,
                    recent_message_count: recentCount,
                    recent_message_window_start: windowStart,
                });

                log.info({
                    category: 'sparks',
                    action: 'spam_suppressed',
                    guildId,
                    discordId,
                    recentCount,
                    suppressedUntil: nextHour,
                }, 'User suppressed for spam');

                return { earned: false, amount: 0, reason: 'spam_detected' };
            }

            // Calculate earnings
            let sparksToEarn = 1; // Base earn
            let isFirstOfDay = false;

            // Check for daily bonus (first qualifying message of the day)
            if (!engagement.last_daily_bonus_at ||
                new Date(engagement.last_daily_bonus_at).toISOString().split('T')[0] !== today) {
                sparksToEarn += DAILY_BONUS_SPARKS;
                isFirstOfDay = true;
            }

            // Don't exceed daily cap
            const remainingCap = DAILY_SPARK_CAP - engagement.daily_sparks_earned;
            sparksToEarn = Math.min(sparksToEarn, remainingCap);

            if (sparksToEarn <= 0) {
                return { earned: false, amount: 0, reason: 'daily_cap_reached' };
            }

            // Update balance
            const balance = await tables.SparksBalance.findOne({
                where: { user_id: user.id },
            });

            await balance.update({
                current_balance: balance.current_balance + sparksToEarn,
                lifetime_earned: balance.lifetime_earned + sparksToEarn,
            });

            // Log transaction
            await tables.SparksLedger.create({
                user_id: user.id,
                type: isFirstOfDay ? 'daily_bonus' : 'earn',
                amount: sparksToEarn,
                ref_type: 'message',
                ref_id: message.id,
                description: isFirstOfDay
                    ? `Daily bonus (+${DAILY_BONUS_SPARKS}) + message`
                    : 'Message engagement',
            });

            // Update engagement stats
            await engagement.update({
                daily_earn_count: engagement.daily_earn_count + 1,
                daily_sparks_earned: engagement.daily_sparks_earned + sparksToEarn,
                last_earn_at: now,
                last_daily_bonus_at: isFirstOfDay ? now : engagement.last_daily_bonus_at,
                recent_message_count: recentCount,
                recent_message_window_start: windowStart,
            });

            log.debug({
                category: 'sparks',
                action: 'earned',
                guildId,
                discordId,
                amount: sparksToEarn,
                isFirstOfDay,
                newBalance: balance.current_balance + sparksToEarn,
            }, 'User earned sparks');

            return {
                earned: true,
                amount: sparksToEarn,
                reason: 'success',
                isFirstOfDay,
            };

        } catch (error) {
            log.error({
                category: 'sparks',
                action: 'process_error',
                error,
                guildId,
                discordId,
            }, 'Error processing message for sparks');

            return { earned: false, amount: 0, reason: 'error' };
        }
    }

    /**
     * Add sparks to a user's balance (for admin/special cases)
     */
    async addSparks(
        guildId: string,
        discordId: string,
        amount: number,
        description: string,
        refType = 'admin',
    ): Promise<boolean> {
        const { tables, log } = this.context;

        try {
            const user = await this.getOrCreateUser(guildId, discordId);

            const balance = await tables.SparksBalance.findOne({
                where: { user_id: user.id },
            });

            await balance.update({
                current_balance: balance.current_balance + amount,
                lifetime_earned: balance.lifetime_earned + amount,
            });

            await tables.SparksLedger.create({
                user_id: user.id,
                type: 'earn',
                amount,
                ref_type: refType,
                description,
            });

            log.info({
                category: 'sparks',
                action: 'admin_add',
                guildId,
                discordId,
                amount,
                description,
            }, 'Admin added sparks to user');

            return true;
        } catch (error) {
            log.error({ error }, 'Failed to add sparks');
            return false;
        }
    }

    /**
     * Remove sparks from a user's balance
     */
    async removeSparks(
        guildId: string,
        discordId: string,
        amount: number,
        description: string,
        refType = 'spend',
    ): Promise<boolean> {
        const { tables, log } = this.context;

        try {
            const user = await tables.SparksUser.findOne({
                where: { guild_id: guildId, discord_id: discordId },
            });

            if (!user) {
                return false;
            }

            const balance = await tables.SparksBalance.findOne({
                where: { user_id: user.id },
            });

            const available = balance.current_balance - balance.escrow_balance;
            if (available < amount) {
                return false;
            }

            await balance.update({
                current_balance: balance.current_balance - amount,
                lifetime_spent: balance.lifetime_spent + amount,
            });

            await tables.SparksLedger.create({
                user_id: user.id,
                type: 'spend',
                amount: -amount,
                ref_type: refType,
                description,
            });

            log.info({
                category: 'sparks',
                action: 'spend',
                guildId,
                discordId,
                amount,
                description,
            }, 'User spent sparks');

            return true;
        } catch (error) {
            log.error({ error }, 'Failed to remove sparks');
            return false;
        }
    }
}
