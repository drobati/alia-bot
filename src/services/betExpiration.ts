import { Context } from '../utils/types';
import { Op } from 'sequelize';

export class BetExpirationService {
    private context: Context;
    private intervalId: NodeJS.Timeout | null = null;
    private readonly CHECK_INTERVAL = 2 * 60 * 1000; // 2 minutes

    constructor(context: Context) {
        this.context = context;
    }

    start(): void {
        if (this.intervalId) {
            this.context.log.warn('BetExpirationService already running');
            return;
        }

        this.context.log.info('Starting BetExpirationService');

        // Run immediately, then every 2 minutes
        this.processExpiredBets();
        this.intervalId = setInterval(() => {
            this.processExpiredBets();
        }, this.CHECK_INTERVAL);
    }

    stop(): void {
        if (this.intervalId) {
            clearInterval(this.intervalId);
            this.intervalId = null;
            this.context.log.info('BetExpirationService stopped');
        }
    }

    private async processExpiredBets(): Promise<void> {
        const { tables, sequelize, log } = this.context;

        try {
            // Find expired bets
            const expiredBets = await tables.BetWagers.findAll({
                where: {
                    status: 'open',
                    closes_at: { [Op.lt]: new Date() },
                },
            });

            if (expiredBets.length === 0) {
                return; // No expired bets to process
            }

            log.info(`Processing ${expiredBets.length} expired bets`);

            for (const bet of expiredBets) {
                const transaction = await sequelize.transaction();

                try {
                    log.info(`Processing expired bet: ${bet.id} - "${bet.statement}"`);

                    // Get participants for this bet
                    const participants = await tables.BetParticipants.findAll({
                        where: { bet_id: bet.id },
                        transaction,
                    });

                    // Refund participants
                    for (const participant of participants) {
                        log.info(`Refunding ${participant.amount} Sparks to user ${participant.user_id}`);

                        // Get current balance
                        const balance = await tables.BetBalances.findOne({
                            where: { user_id: participant.user_id },
                            transaction,
                        });

                        if (balance) {
                            // Update balance: move escrow back to available
                            await tables.BetBalances.update(
                                {
                                    current_balance: balance.current_balance + participant.amount,
                                    escrow_balance: balance.escrow_balance - participant.amount,
                                },
                                {
                                    where: { user_id: participant.user_id },
                                    transaction,
                                },
                            );

                            // Record refund transaction
                            await tables.BetLedger.create({
                                user_id: participant.user_id,
                                type: 'refund',
                                amount: participant.amount,
                                ref_type: 'bet_wager',
                                ref_id: bet.id,
                            }, { transaction });

                            log.info(`Refunded ${participant.amount} Sparks to user ${participant.user_id}`);
                        }
                    }

                    // Mark bet as settled with void outcome
                    await bet.update({
                        status: 'settled',
                        outcome: 'void',
                        settled_at: new Date(),
                    }, { transaction });

                    await transaction.commit();
                    log.info(`✅ Expired bet ${bet.id} processed successfully`);

                } catch (error) {
                    await transaction.rollback();
                    log.error(`Error processing expired bet ${bet.id}:`, error);
                }
            }

        } catch (error) {
            log.error('Error in BetExpirationService:', error);
        }
    }
}