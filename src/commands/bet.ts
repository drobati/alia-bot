import {
    SlashCommandBuilder,
    SlashCommandSubcommandsOnlyBuilder,
    ChatInputCommandInteraction,
    EmbedBuilder,
    ButtonBuilder,
    ButtonStyle,
    ActionRowBuilder,
} from 'discord.js';
import { Context } from '../utils/types';
import { Op } from 'sequelize';
import config from 'config';

// Generate short, user-friendly bet IDs
function generateShortBetId(): string {
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0,O,1,I)
    let id = '';
    for (let i = 0; i < 6; i++) {
        id += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    return id;
}

interface BetSlashCommand {
    data: SlashCommandBuilder | SlashCommandSubcommandsOnlyBuilder;
    execute(
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _interaction: ChatInputCommandInteraction,
        // eslint-disable-next-line @typescript-eslint/no-unused-vars, no-unused-vars
        _context: Context,
    ): Promise<void>;
}

const betCommand: BetSlashCommand = {
    data: new SlashCommandBuilder()
        .setName('bet')
        .setDescription('Betting system for Sparks currency')
        .addSubcommand(subcommand =>
            subcommand
                .setName('open')
                .setDescription('Create a new bet')
                .addStringOption(option =>
                    option.setName('statement')
                        .setDescription('The statement to bet on (200 characters max)')
                        .setRequired(true),
                )
                .addIntegerOption(option =>
                    option.setName('odds_for')
                        .setDescription('Odds for the "yes" side (1-10)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10),
                )
                .addIntegerOption(option =>
                    option.setName('odds_against')
                        .setDescription('Odds for the "no" side (1-10)')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10),
                )
                .addIntegerOption(option =>
                    option.setName('duration')
                        .setDescription('Duration in minutes before betting closes')
                        .setRequired(true)
                        .setMinValue(5)
                        .setMaxValue(10080), // 1 week
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('join')
                .setDescription('Join an existing bet')
                .addStringOption(option =>
                    option.setName('bet_id')
                        .setDescription('The bet ID to join')
                        .setRequired(true)
                        .setAutocomplete(true),
                )
                .addStringOption(option =>
                    option.setName('side')
                        .setDescription('Which side to bet on (for = yes, against = no)')
                        .setRequired(true)
                        .addChoices(
                            { name: 'for', value: 'for' },
                            { name: 'against', value: 'against' },
                        ),
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of Sparks to wager')
                        .setRequired(true)
                        .setMinValue(1),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List active bets'),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('details')
                .setDescription('Show detailed information about a bet including participants')
                .addStringOption(option =>
                    option.setName('bet_id')
                        .setDescription('The bet ID to view details for')
                        .setRequired(true)
                        .setAutocomplete(true),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('settle')
                .setDescription('Settle a bet (opener only)')
                .addStringOption(option =>
                    option.setName('bet_id')
                        .setDescription('The bet ID to settle')
                        .setRequired(true)
                        .setAutocomplete(true),
                )
                .addStringOption(option =>
                    option.setName('outcome')
                        .setDescription('The outcome of the bet')
                        .setRequired(true)
                        .addChoices(
                            { name: 'for', value: 'for' },
                            { name: 'against', value: 'against' },
                            { name: 'void', value: 'void' },
                        ),
                ),
        )
        .addSubcommand(subcommand =>
            subcommand
                .setName('admin-payout')
                .setDescription('Issue manual payout for bet discrepancies (owner only)')
                .addUserOption(option =>
                    option.setName('user')
                        .setDescription('Discord user to credit')
                        .setRequired(true),
                )
                .addIntegerOption(option =>
                    option.setName('amount')
                        .setDescription('Amount of Sparks to credit')
                        .setRequired(true)
                        .setMinValue(1)
                        .setMaxValue(10000),
                )
                .addStringOption(option =>
                    option.setName('reason')
                        .setDescription('Reason for the manual payout (audit trail)')
                        .setRequired(true)
                        .setMaxLength(200),
                )
                .addStringOption(option =>
                    option.setName('bet_id')
                        .setDescription('Optional: Related bet ID for reference')
                        .setRequired(false),
                ),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
        const { log } = context;
        const subcommand = interaction.options.getSubcommand();

        try {
            switch (subcommand) {
                case 'open':
                    await handleOpenBet(interaction, context);
                    break;
                case 'join':
                    await handleJoinBet(interaction, context);
                    break;
                case 'list':
                    await handleListBets(interaction, context);
                    break;
                case 'details':
                    await handleBetDetails(interaction, context);
                    break;
                case 'settle':
                    await handleSettleBet(interaction, context);
                    break;
                case 'admin-payout':
                    await handleAdminPayout(interaction, context);
                    break;
                default:
                    await interaction.reply({
                        content: 'Invalid subcommand.',
                        ephemeral: true,
                    });
            }
        } catch (error) {
            log.error('Error in bet command:', error);
            const errorMessage = error instanceof Error ? error.message : 'An unexpected error occurred';

            if (!interaction.replied && !interaction.deferred) {
                await interaction.reply({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true,
                });
            } else {
                await interaction.followUp({
                    content: `❌ ${errorMessage}`,
                    ephemeral: true,
                });
            }
        }
    },
};

async function handleOpenBet(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables, sequelize } = context;
    const statement = interaction.options.getString('statement', true);
    const oddsFor = interaction.options.getInteger('odds_for', true);
    const oddsAgainst = interaction.options.getInteger('odds_against', true);
    const durationMinutes = interaction.options.getInteger('duration', true);

    if (statement.length > 200) {
        await interaction.reply({
            content: '❌ Statement must be 200 characters or less.',
            ephemeral: true,
        });
        return;
    }

    const transaction = await sequelize.transaction();

    try {
        // Ensure user exists
        let user = await tables.BetUsers.findOne({
            where: { discord_id: interaction.user.id },
            transaction,
        });

        if (!user) {
            user = await tables.BetUsers.create({
                discord_id: interaction.user.id,
                handle: null,
                hide_last_seen: false,
            }, { transaction });

            // Create initial balance
            await tables.BetBalances.create({
                user_id: user.id,
                current_balance: 100, // Starting balance
                escrow_balance: 0,
            }, { transaction });
        }

        // Create the bet
        const closesAt = new Date(Date.now() + (durationMinutes * 60 * 1000));
        // Generate unique short ID
        let betId: string;
        let attempts = 0;
        do {
            betId = generateShortBetId();
            attempts++;
            const existing = await tables.BetWagers.findByPk(betId, { transaction });
            if (!existing) {break;}
        } while (attempts < 10);

        if (attempts >= 10) {
            throw new Error('Unable to generate unique bet ID');
        }

        const bet = await tables.BetWagers.create({
            id: betId,
            opener_id: user.id,
            statement,
            odds_for: oddsFor,
            odds_against: oddsAgainst,
            status: 'open',
            total_for: 0,
            total_against: 0,
            opens_at: new Date(),
            closes_at: closesAt,
        }, { transaction });

        await transaction.commit();

        const embed = new EmbedBuilder()
            .setTitle('🎲 New Bet Created!')
            .setDescription(`**${statement}**`)
            .addFields(
                { name: 'Bet ID', value: bet.id, inline: true },
                { name: 'Odds For', value: `${oddsFor}:1`, inline: true },
                { name: 'Odds Against', value: `${oddsAgainst}:1`, inline: true },
                { name: 'Closes At', value: `<t:${Math.floor(closesAt.getTime() / 1000)}:R>`, inline: false },
                { name: 'Total For', value: '0 Sparks', inline: true },
                { name: 'Total Against', value: '0 Sparks', inline: true },
            )
            .setColor('#00ff00')
            .setFooter({ text: `Opened by ${interaction.user.username}` });

        const joinButton = new ButtonBuilder()
            .setCustomId(`bet_join_${bet.id}`)
            .setLabel('Join Bet')
            .setStyle(ButtonStyle.Primary);

        const row = new ActionRowBuilder<ButtonBuilder>()
            .addComponents(joinButton);

        await interaction.reply({
            embeds: [embed],
            components: [row],
        });

    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function handleJoinBet(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables, sequelize } = context;
    const betId = interaction.options.getString('bet_id', true);
    const side = interaction.options.getString('side', true) as 'for' | 'against';
    const amount = interaction.options.getInteger('amount', true);

    const transaction = await sequelize.transaction();

    try {
        // Get or create user
        let user = await tables.BetUsers.findOne({
            where: { discord_id: interaction.user.id },
            transaction,
        });

        if (!user) {
            user = await tables.BetUsers.create({
                discord_id: interaction.user.id,
                handle: null,
                hide_last_seen: false,
            }, { transaction });

            await tables.BetBalances.create({
                user_id: user.id,
                current_balance: 100, // Starting balance
                escrow_balance: 0,
            }, { transaction });
        }

        // Get user balance
        const balance = await tables.BetBalances.findOne({
            where: { user_id: user.id },
            transaction,
        });

        if (!balance || balance.current_balance < amount) {
            await transaction.rollback();
            await interaction.reply({
                content: `❌ Insufficient balance. You need ${amount} Sparks but only have ${
                    balance?.current_balance || 0
                }.`,
                ephemeral: true,
            });
            return;
        }

        // Get bet
        const bet = await tables.BetWagers.findByPk(betId, { transaction });
        if (!bet) {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ Bet not found.',
                ephemeral: true,
            });
            return;
        }

        if (bet.status !== 'open') {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ This bet is no longer accepting participants.',
                ephemeral: true,
            });
            return;
        }

        if (bet.closes_at <= new Date()) {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ This bet has already closed.',
                ephemeral: true,
            });
            return;
        }

        // Check if user already participated
        const existingParticipation = await tables.BetParticipants.findOne({
            where: {
                bet_id: betId,
                user_id: user.id,
            },
            transaction,
        });

        if (existingParticipation) {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ You have already joined this bet.',
                ephemeral: true,
            });
            return;
        }

        // Escrow the funds
        await tables.BetBalances.update(
            {
                current_balance: balance.current_balance - amount,
                escrow_balance: balance.escrow_balance + amount,
            },
            {
                where: { user_id: user.id },
                transaction,
            },
        );

        // Record the transaction
        await tables.BetLedger.create({
            user_id: user.id,
            type: 'escrow_in',
            amount,
            ref_type: 'bet_wager',
            ref_id: betId,
            meta: { side },
        }, { transaction });

        // Join the bet
        await tables.BetParticipants.create({
            bet_id: betId,
            user_id: user.id,
            side,
            amount,
            joined_at: new Date(),
        }, { transaction });

        // Update bet totals
        if (side === 'for') {
            bet.total_for += amount;
        } else {
            bet.total_against += amount;
        }
        await bet.save({ transaction });

        await transaction.commit();

        await interaction.reply({
            content: `✅ Successfully joined bet "${bet.statement}" on the **${
                side.toUpperCase()
            }** side with ${amount} Sparks!`,
            ephemeral: true,
        });

    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function handleListBets(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables } = context;

    const activeBets = await tables.BetWagers.findAll({
        where: {
            status: 'open',
            closes_at: { [Op.gt]: new Date() },
        },
        order: [['created_at', 'DESC']],
        limit: 10,
    });

    if (activeBets.length === 0) {
        await interaction.reply({
            content: '📊 No active bets found.',
            ephemeral: true,
        });
        return;
    }

    const embed = new EmbedBuilder()
        .setTitle('🎲 Active Bets')
        .setColor('#0099ff');

    for (const bet of activeBets) {
        const closesAt = Math.floor(bet.closes_at.getTime() / 1000);
        embed.addFields({
            name: `${bet.statement}`,
            value: `**ID:** ${bet.id}\n**Odds:** ${bet.odds_for}:1 (For) | ${
                bet.odds_against
            }:1 (Against)\n**Totals:** ${bet.total_for} vs ${bet.total_against} Sparks\n**Closes:** <t:${closesAt}:R>`,
            inline: false,
        });
    }

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

async function handleBetDetails(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables } = context;
    const betId = interaction.options.getString('bet_id', true);

    // Get bet details
    const bet = await tables.BetWagers.findByPk(betId);
    if (!bet) {
        await interaction.reply({
            content: '❌ Bet not found.',
            ephemeral: true,
        });
        return;
    }

    // Get bet opener details
    const opener = await tables.BetUsers.findByPk(bet.opener_id);
    if (!opener) {
        await interaction.reply({
            content: '❌ Bet opener not found.',
            ephemeral: true,
        });
        return;
    }

    // Get all participants
    const participants = await tables.BetParticipants.findAll({
        where: { bet_id: betId },
    });

    // Get user details for participants
    const participantsWithUsers = await Promise.all(
        participants.map(async (participant: any) => {
            const user = await tables.BetUsers.findByPk(participant.user_id);
            return { ...participant.toJSON(), user };
        }),
    );

    // Separate participants by side
    const forParticipants = participantsWithUsers.filter((p: any) => p.side === 'for');
    const againstParticipants = participantsWithUsers.filter((p: any) => p.side === 'against');

    const embed = new EmbedBuilder()
        .setTitle(`🎲 Bet Details: ${bet.statement}`)
        .setColor(bet.status === 'open' ? '#00ff00' : bet.status === 'settled' ? '#ff9900' : '#ff0000')
        .addFields(
            { name: 'Bet ID', value: bet.id, inline: true },
            { name: 'Status', value: bet.status.toUpperCase(), inline: true },
            { name: 'Opened By', value: `<@${opener.discord_id}>`, inline: true },
            { name: 'Odds For (Yes)', value: `${bet.odds_for}:1`, inline: true },
            { name: 'Odds Against (No)', value: `${bet.odds_against}:1`, inline: true },
            { name: 'Total Pool', value: `${bet.total_for + bet.total_against} Sparks`, inline: true },
        );

    // Add timing information
    if (bet.status === 'open') {
        const closesAt = Math.floor(bet.closes_at.getTime() / 1000);
        embed.addFields({ name: 'Closes', value: `<t:${closesAt}:R>`, inline: false });
    } else if (bet.settled_at) {
        const settledAt = Math.floor(bet.settled_at.getTime() / 1000);
        embed.addFields(
            { name: 'Settled', value: `<t:${settledAt}:R>`, inline: true },
            { name: 'Outcome', value: bet.outcome?.toUpperCase() || 'N/A', inline: true },
        );
    }

    // Add participants information
    if (forParticipants.length > 0) {
        const forList = forParticipants
            .map((p: any) => `<@${p.user?.discord_id || 'Unknown'}> - ${p.amount} Sparks`)
            .join('\n');
        embed.addFields({
            name: `📈 FOR (${forParticipants.length} participants, ${bet.total_for} Sparks)`,
            value: forList.length > 1024 ? forList.substring(0, 1020) + '...' : forList,
            inline: false,
        });
    } else {
        embed.addFields({ name: '📈 FOR (0 participants)', value: 'No participants yet', inline: false });
    }

    if (againstParticipants.length > 0) {
        const againstList = againstParticipants
            .map((p: any) => `<@${p.user?.discord_id || 'Unknown'}> - ${p.amount} Sparks`)
            .join('\n');
        embed.addFields({
            name: `📉 AGAINST (${againstParticipants.length} participants, ${bet.total_against} Sparks)`,
            value: againstList.length > 1024 ? againstList.substring(0, 1020) + '...' : againstList,
            inline: false,
        });
    } else {
        embed.addFields({ name: '📉 AGAINST (0 participants)', value: 'No participants yet', inline: false });
    }

    await interaction.reply({
        embeds: [embed],
        ephemeral: true,
    });
}

async function handleSettleBet(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables, sequelize } = context;
    const betId = interaction.options.getString('bet_id', true);
    const outcome = interaction.options.getString('outcome', true) as 'for' | 'against' | 'void';

    const transaction = await sequelize.transaction();

    try {
        // Get user
        const user = await tables.BetUsers.findOne({
            where: { discord_id: interaction.user.id },
            transaction,
        });

        if (!user) {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ User not found in betting system.',
                ephemeral: true,
            });
            return;
        }

        // Get bet
        const bet = await tables.BetWagers.findByPk(betId, { transaction });
        if (!bet) {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ Bet not found.',
                ephemeral: true,
            });
            return;
        }

        // Check if user is the opener
        if (bet.opener_id !== user.id) {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ Only the bet opener can settle this bet.',
                ephemeral: true,
            });
            return;
        }

        if (bet.status !== 'open') {
            await transaction.rollback();
            await interaction.reply({
                content: '❌ This bet has already been settled.',
                ephemeral: true,
            });
            return;
        }

        // Get all participants
        const participants = await tables.BetParticipants.findAll({
            where: { bet_id: betId },
            transaction,
        });

        if (participants.length === 0) {
            // No participants, just close the bet
            await bet.update({
                status: 'settled',
                outcome: 'void',
                settled_at: new Date(),
            }, { transaction });

            await transaction.commit();

            await interaction.reply({
                content: `✅ Bet "${bet.statement}" settled as void (no participants).`,
            });
            return;
        }

        // Process payouts
        for (const participant of participants) {
            const balance = await tables.BetBalances.findOne({
                where: { user_id: participant.user_id },
                transaction,
            });

            if (!balance) {continue;}

            if (outcome === 'void') {
                // Refund everyone
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

                await tables.BetLedger.create({
                    user_id: participant.user_id,
                    type: 'refund',
                    amount: participant.amount,
                    ref_type: 'bet_wager',
                    ref_id: betId,
                }, { transaction });

            } else {
                if (participant.side === outcome) {
                    // Winner - calculate winnings and return stake from escrow
                    const winnerOdds = outcome === 'for' ? bet.odds_for : bet.odds_against;
                    const winnings = participant.amount * winnerOdds;

                    context.log.info(
                        `Winner payout: Balance before: ${balance.current_balance}, ` +
                        `Stake: ${participant.amount}, Winnings: ${winnings}, ` +
                        `Total payout: ${participant.amount + winnings}`
                    );

                    // Release escrow (stake) back to current_balance AND add winnings
                    const newBalance = balance.current_balance + participant.amount + winnings;
                    await tables.BetBalances.update(
                        {
                            current_balance: newBalance,
                            escrow_balance: balance.escrow_balance - participant.amount,
                        },
                        {
                            where: { user_id: participant.user_id },
                            transaction,
                        },
                    );

                    context.log.info(
                        `Winner balance updated to: ${newBalance}, escrow reduced by: ${participant.amount}`
                    );

                    // Record escrow release
                    await tables.BetLedger.create({
                        user_id: participant.user_id,
                        type: 'escrow_out',
                        amount: participant.amount,
                        ref_type: 'bet_wager',
                        ref_id: betId,
                    }, { transaction });

                    // Record payout (winnings only, since stake was released from escrow)
                    await tables.BetLedger.create({
                        user_id: participant.user_id,
                        type: 'payout',
                        amount: winnings,
                        ref_type: 'bet_wager',
                        ref_id: betId,
                        meta: { original_wager: participant.amount, winnings, odds: winnerOdds },
                    }, { transaction });
                } else {
                    // Loser - just release escrow (no payout)
                    await tables.BetBalances.update(
                        {
                            escrow_balance: balance.escrow_balance - participant.amount,
                        },
                        {
                            where: { user_id: participant.user_id },
                            transaction,
                        },
                    );

                    await tables.BetLedger.create({
                        user_id: participant.user_id,
                        type: 'escrow_out',
                        amount: participant.amount,
                        ref_type: 'bet_wager',
                        ref_id: betId,
                    }, { transaction });
                }
            }
        }

        // Update bet status
        await bet.update({
            status: 'settled',
            outcome,
            settled_at: new Date(),
        }, { transaction });

        await transaction.commit();

        const outcomeText = outcome === 'void' ? 'voided (all refunded)' :
            outcome === 'for' ? 'settled as FOR (Yes)' : 'settled as AGAINST (No)';

        await interaction.reply({
            content: `✅ Bet "${bet.statement}" has been ${outcomeText}. All payouts have been processed.`,
        });

    } catch (error) {
        await transaction.rollback();
        throw error;
    }
}

async function handleAdminPayout(interaction: ChatInputCommandInteraction, context: Context): Promise<void> {
    const { tables, sequelize, log } = context;
    const targetUser = interaction.options.getUser('user', true);
    const amount = interaction.options.getInteger('amount', true);
    const reason = interaction.options.getString('reason', true);
    const betId = interaction.options.getString('bet_id', false);

    // Owner-only permission check
    const ownerId: string = config.get('owner');
    if (interaction.user.id !== ownerId) {
        await interaction.reply({
            content: '❌ This command is restricted to the bot owner only.',
            ephemeral: true,
        });
        return;
    }

    const transaction = await sequelize.transaction();

    try {
        // Ensure target user exists in betting system
        let user = await tables.BetUsers.findOne({
            where: { discord_id: targetUser.id },
            transaction,
        });

        if (!user) {
            // Create user if they don't exist
            user = await tables.BetUsers.create({
                discord_id: targetUser.id,
                handle: null,
                hide_last_seen: false,
            }, { transaction });

            // Create initial balance (they'll get the payout amount plus starting balance)
            await tables.BetBalances.create({
                user_id: user.id,
                current_balance: 100, // Starting balance
                escrow_balance: 0,
            }, { transaction });
        }

        // Get user's current balance
        const balance = await tables.BetBalances.findOne({
            where: { user_id: user.id },
            transaction,
        });

        if (!balance) {
            throw new Error('Balance record not found for user');
        }

        const oldBalance = balance.current_balance;
        const newBalance = oldBalance + amount;

        // Update balance
        await tables.BetBalances.update(
            {
                current_balance: newBalance,
                lifetime_earned: balance.lifetime_earned + amount,
            },
            {
                where: { user_id: user.id },
                transaction,
            },
        );

        // Create audit trail in ledger
        await tables.BetLedger.create({
            user_id: user.id,
            type: 'admin_credit',
            amount,
            ref_type: 'admin_correction',
            ref_id: betId || `admin_${Date.now()}`,
            meta: {
                admin_user: interaction.user.id,
                admin_username: interaction.user.username,
                reason,
                related_bet: betId || null,
                old_balance: oldBalance,
                new_balance: newBalance,
            },
        }, { transaction });

        await transaction.commit();

        log.info(`Admin payout issued`, {
            admin_id: interaction.user.id,
            admin_username: interaction.user.username,
            target_id: targetUser.id,
            target_username: targetUser.username,
            amount,
            reason,
            bet_id: betId,
            old_balance: oldBalance,
            new_balance: newBalance,
        });

        // Create success embed
        const embed = new EmbedBuilder()
            .setTitle('💰 Admin Payout Issued')
            .setDescription(`Manual payout successfully processed for <@${targetUser.id}>`)
            .addFields(
                { name: 'Amount', value: `${amount} Sparks`, inline: true },
                { name: 'Previous Balance', value: `${oldBalance} Sparks`, inline: true },
                { name: 'New Balance', value: `${newBalance} Sparks`, inline: true },
                { name: 'Reason', value: reason, inline: false },
            )
            .setColor('#00ff00')
            .setFooter({
                text: `Issued by ${interaction.user.username}`,
                iconURL: interaction.user.displayAvatarURL(),
            })
            .setTimestamp();

        if (betId) {
            embed.addFields({ name: 'Related Bet ID', value: betId, inline: true });
        }

        await interaction.reply({
            embeds: [embed],
            ephemeral: false, // Make it visible to confirm the action was taken
        });

        // Optional: Send a DM to the user who received the payout
        try {
            const dmEmbed = new EmbedBuilder()
                .setTitle('💰 Sparks Credit Received')
                .setDescription(`You have received a manual credit to your Sparks balance.`)
                .addFields(
                    { name: 'Amount', value: `${amount} Sparks`, inline: true },
                    { name: 'New Balance', value: `${newBalance} Sparks`, inline: true },
                    { name: 'Reason', value: reason, inline: false },
                )
                .setColor('#00ff00')
                .setTimestamp();

            await targetUser.send({ embeds: [dmEmbed] });
        } catch (dmError) {
            log.warn('Failed to send DM to user about admin payout', {
                user_id: targetUser.id,
                error: dmError instanceof Error ? dmError.message : dmError,
            });
        }

    } catch (error) {
        await transaction.rollback();
        log.error('Admin payout failed', {
            admin_id: interaction.user.id,
            target_id: targetUser.id,
            amount,
            reason,
            bet_id: betId,
            error: error instanceof Error ? error.message : error,
        });
        throw error;
    }
}

const betCommandWithAutocomplete = {
    ...betCommand,
    async autocomplete(interaction: any, context: Context) {
        const { tables } = context;
        const focusedOption = interaction.options.getFocused(true);

        if (focusedOption.name === 'bet_id') {
            const subcommand = interaction.options.getSubcommand();

            try {
                let bets;

                if (subcommand === 'settle') {
                    // For settle, show only open bets that the user created
                    const user = await tables.BetUsers.findOne({
                        where: { discord_id: interaction.user.id },
                    });

                    if (user) {
                        bets = await tables.BetWagers.findAll({
                            where: {
                                status: 'open',
                                opener_id: user.id,
                            },
                            order: [['created_at', 'DESC']],
                            limit: 25,
                        });
                    } else {
                        bets = [];
                    }
                } else if (subcommand === 'details') {
                    // For details, show all bets (open and settled)
                    bets = await tables.BetWagers.findAll({
                        order: [['created_at', 'DESC']],
                        limit: 25,
                    });
                } else {
                    // For join, show all open bets
                    bets = await tables.BetWagers.findAll({
                        where: { status: 'open' },
                        order: [['created_at', 'DESC']],
                        limit: 25,
                    });
                }

                const filtered = bets
                    .filter((bet: any) =>
                        bet.id.toLowerCase().includes(focusedOption.value.toLowerCase()) ||
                        bet.statement.toLowerCase().includes(focusedOption.value.toLowerCase()),
                    )
                    .slice(0, 25);

                await interaction.respond(
                    filtered.map((bet: any) => ({
                        name: `${bet.statement.substring(0, 50)}${bet.statement.length > 50 ? '...' : ''} (${bet.id})`,
                        value: bet.id,
                    })),
                );
            } catch (error) {
                context.log.error('Autocomplete error:', error);
                await interaction.respond([]);
            }
        }
    },
};

export default betCommandWithAutocomplete;