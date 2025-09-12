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
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option.setName('side')
                        .setDescription('Which side to bet on')
                        .setRequired(true)
                        .addChoices(
                            { name: 'For (Yes)', value: 'for' },
                            { name: 'Against (No)', value: 'against' },
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
                .setName('settle')
                .setDescription('Settle a bet (opener only)')
                .addStringOption(option =>
                    option.setName('bet_id')
                        .setDescription('The bet ID to settle')
                        .setRequired(true),
                )
                .addStringOption(option =>
                    option.setName('outcome')
                        .setDescription('The outcome of the bet')
                        .setRequired(true)
                        .addChoices(
                            { name: 'For (Yes) wins', value: 'for' },
                            { name: 'Against (No) wins', value: 'against' },
                            { name: 'Void (refund all)', value: 'void' },
                        ),
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
                case 'settle':
                    await handleSettleBet(interaction, context);
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
                available_balance: 100, // Starting balance
                escrowed_balance: 0,
            }, { transaction });
        }

        // Create the bet
        const closesAt = new Date(Date.now() + (durationMinutes * 60 * 1000));
        const bet = await tables.BetWagers.create({
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
                available_balance: 100, // Starting balance
                escrowed_balance: 0,
            }, { transaction });
        }

        // Get user balance
        const balance = await tables.BetBalances.findOne({
            where: { user_id: user.id },
            transaction,
        });

        if (!balance || balance.available_balance < amount) {
            await transaction.rollback();
            await interaction.reply({
                content: `❌ Insufficient balance. You need ${amount} Sparks but only have ${
                    balance?.available_balance || 0
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
        await balance.update({
            available_balance: balance.available_balance - amount,
            escrowed_balance: balance.escrowed_balance + amount,
        }, { transaction });

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
                await balance.update({
                    available_balance: balance.available_balance + participant.amount,
                    escrowed_balance: balance.escrowed_balance - participant.amount,
                }, { transaction });

                await tables.BetLedger.create({
                    user_id: participant.user_id,
                    type: 'refund',
                    amount: participant.amount,
                    ref_type: 'bet_wager',
                    ref_id: betId,
                }, { transaction });

            } else {
                // Release escrow first
                await balance.update({
                    escrowed_balance: balance.escrowed_balance - participant.amount,
                }, { transaction });

                await tables.BetLedger.create({
                    user_id: participant.user_id,
                    type: 'escrow_out',
                    amount: participant.amount,
                    ref_type: 'bet_wager',
                    ref_id: betId,
                }, { transaction });

                if (participant.side === outcome) {
                    // Winner - calculate payout
                    const winnerOdds = outcome === 'for' ? bet.odds_for : bet.odds_against;
                    const payout = participant.amount + (participant.amount * winnerOdds);

                    await balance.update({
                        available_balance: balance.available_balance + payout,
                    }, { transaction });

                    await tables.BetLedger.create({
                        user_id: participant.user_id,
                        type: 'payout',
                        amount: payout,
                        ref_type: 'bet_wager',
                        ref_id: betId,
                        meta: { original_wager: participant.amount, odds: winnerOdds },
                    }, { transaction });
                }
                // Losers get nothing (their escrow was already released)
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

export default betCommand;