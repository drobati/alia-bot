import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { Context } from '../utils/types';

const tributeCommand = {
    data: new SlashCommandBuilder()
        .setName('tribute')
        .setDescription('Pay tribute in spice to another member of the sietch')
        .addUserOption(option =>
            option
                .setName('user')
                .setDescription('The user to pay tribute to')
                .setRequired(true),
        )
        .addIntegerOption(option =>
            option
                .setName('amount')
                .setDescription('Amount of spice to offer as tribute')
                .setRequired(true)
                .setMinValue(1),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { tables, log, sequelize } = context;

        if (!interaction.guild) {
            await interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
            return;
        }

        const targetUser = interaction.options.getUser('user', true);
        const amount = interaction.options.getInteger('amount', true);
        const guildId = interaction.guild.id;
        const senderId = interaction.user.id;
        const senderUsername = interaction.user.username;

        // Validate not giving to self
        if (targetUser.id === senderId) {
            await interaction.reply({
                content: 'One cannot pay tribute to oneself. The desert sees all.',
                ephemeral: true,
            });
            return;
        }

        // Validate not giving to a bot
        if (targetUser.bot) {
            await interaction.reply({
                content: 'Machines have no use for spice.',
                ephemeral: true,
            });
            return;
        }

        // Use a transaction to ensure atomicity
        const transaction = await sequelize.transaction();

        try {
            // Get sender's balance
            const senderBalance = await tables.SpiceBalance.findOne({
                where: { guild_id: guildId, discord_id: senderId },
                transaction,
            });

            if (!senderBalance || senderBalance.current_balance < amount) {
                await transaction.rollback();
                const currentBalance = senderBalance?.current_balance ?? 0;
                await interaction.reply({
                    content: `Your spice reserves are insufficient. ` +
                        `You hold **${currentBalance} spice**, but wish to offer **${amount}**.`,
                    ephemeral: true,
                });
                return;
            }

            // Get or create recipient's balance
            const [recipientBalance] = await tables.SpiceBalance.findOrCreate({
                where: { guild_id: guildId, discord_id: targetUser.id },
                defaults: {
                    guild_id: guildId,
                    discord_id: targetUser.id,
                    username: targetUser.username,
                    current_balance: 0,
                    last_harvest_at: null,
                    lifetime_harvested: 0,
                    lifetime_given: 0,
                    lifetime_received: 0,
                },
                transaction,
            });

            // Update balances
            const now = new Date();
            const senderNewBalance = senderBalance.current_balance - amount;
            const recipientNewBalance = recipientBalance.current_balance + amount;

            await senderBalance.update({
                current_balance: senderNewBalance,
                lifetime_given: senderBalance.lifetime_given + amount,
                username: senderUsername,
            }, { transaction });

            await recipientBalance.update({
                current_balance: recipientNewBalance,
                lifetime_received: recipientBalance.lifetime_received + amount,
                username: targetUser.username,
            }, { transaction });

            // Record both sides of the transaction in the ledger
            await tables.SpiceLedger.create({
                guild_id: guildId,
                discord_id: senderId,
                type: 'tribute_paid',
                amount: -amount,
                target_discord_id: targetUser.id,
                description: `Tribute to ${targetUser.username}`,
                created_at: now,
            }, { transaction });

            await tables.SpiceLedger.create({
                guild_id: guildId,
                discord_id: targetUser.id,
                type: 'tribute_received',
                amount: amount,
                target_discord_id: senderId,
                description: `Tribute from ${senderUsername}`,
                created_at: now,
            }, { transaction });

            await transaction.commit();

            log.info({
                category: 'spice',
                action: 'tribute',
                guildId,
                senderId,
                recipientId: targetUser.id,
                amount,
                senderNewBalance,
                recipientNewBalance,
            }, 'Spice tribute paid');

            // Public message for the tribute action
            await interaction.reply({
                content: `${interaction.user} has paid tribute of **${amount} spice** to ${targetUser}. ` +
                    `*The spice must flow.*`,
            });

        } catch (error) {
            await transaction.rollback();
            log.error({ error }, 'Error paying tribute');
            await interaction.reply({
                content: 'An error occurred while transferring spice.',
                ephemeral: true,
            });
        }
    },
};

export default tributeCommand;
