import {
    SlashCommandBuilder,
    ChatInputCommandInteraction,
} from 'discord.js';
import { Context } from '../utils/types';

const HARVEST_AMOUNT = 10;
const HARVEST_COOLDOWN_MS = 60 * 60 * 1000; // 1 hour in milliseconds

const harvestCommand = {
    data: new SlashCommandBuilder()
        .setName('harvest')
        .setDescription('Harvest spice from the desert (once per hour)')
        .addBooleanOption(option =>
            option
                .setName('public')
                .setDescription('Make the result visible to everyone (default: private)')
                .setRequired(false),
        ),

    async execute(interaction: ChatInputCommandInteraction, context: Context) {
        const { tables, log } = context;

        if (!interaction.guild) {
            await interaction.reply({
                content: 'This command can only be used in a server.',
                ephemeral: true,
            });
            return;
        }

        const isPublic = interaction.options.getBoolean('public') ?? false;
        const guildId = interaction.guild.id;
        const discordId = interaction.user.id;
        const username = interaction.user.username;

        try {
            // Get or create user balance
            const [balance, created] = await tables.SpiceBalance.findOrCreate({
                where: { guild_id: guildId, discord_id: discordId },
                defaults: {
                    guild_id: guildId,
                    discord_id: discordId,
                    username: username,
                    current_balance: 0,
                    last_harvest_at: null,
                    lifetime_harvested: 0,
                    lifetime_given: 0,
                    lifetime_received: 0,
                },
            });

            // Check cooldown
            const now = new Date();
            if (balance.last_harvest_at) {
                const lastHarvest = new Date(balance.last_harvest_at);
                const timeSinceHarvest = now.getTime() - lastHarvest.getTime();

                if (timeSinceHarvest < HARVEST_COOLDOWN_MS) {
                    const remainingMs = HARVEST_COOLDOWN_MS - timeSinceHarvest;
                    const remainingMins = Math.ceil(remainingMs / 60000);

                    await interaction.reply({
                        content: `The spice fields need time to recover. ` +
                            `You can harvest again in **${remainingMins} minute${remainingMins !== 1 ? 's' : ''}**.`,
                        ephemeral: true, // Always private for cooldown message
                    });
                    return;
                }
            }

            // Harvest the spice
            const newBalance = balance.current_balance + HARVEST_AMOUNT;
            const newLifetimeHarvested = balance.lifetime_harvested + HARVEST_AMOUNT;

            await balance.update({
                current_balance: newBalance,
                last_harvest_at: now,
                lifetime_harvested: newLifetimeHarvested,
                username: username, // Update cached username
            });

            // Record in ledger
            await tables.SpiceLedger.create({
                guild_id: guildId,
                discord_id: discordId,
                type: 'harvest',
                amount: HARVEST_AMOUNT,
                description: 'Hourly harvest',
                created_at: now,
            });

            log.info({
                category: 'spice',
                action: 'harvest',
                guildId,
                userId: discordId,
                amount: HARVEST_AMOUNT,
                newBalance,
            }, 'Spice harvested');

            await interaction.reply({
                content: `You harvested **${HARVEST_AMOUNT} spice** from the desert. ` +
                    `Your balance is now **${newBalance} spice**.`,
                ephemeral: !isPublic,
            });

        } catch (error) {
            log.error({ error }, 'Error harvesting spice');
            await interaction.reply({
                content: 'An error occurred while harvesting spice.',
                ephemeral: true,
            });
        }
    },
};

export default harvestCommand;
