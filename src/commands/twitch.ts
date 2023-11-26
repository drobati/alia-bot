import { SlashCommandBuilder } from "discord.js";
import api from "../lib/apis/twitch"; // Ensure this path is correct

async function handleSubscribe(interaction: any, {
    tables,
    log,
}: any) {
    const username = interaction.options.getString('username');
    const user_id = interaction.user.id;
    const record = await tables.Twitch_Users.findOne({ where: { user_id } });

    if (record) {
        await interaction.reply('User is already registered.');
        return;
    }

    try {
        // renew token
        await api.renewToken(tables.Config);
        const userId = await api.getUserId(username, tables.Config);
        if (userId) {
            await api.setWebhook({ userId, mode: 'subscribe', leaseTime: 864000 }, tables.Config, log);
            await tables.Twitch_Users.create({ user_id, twitch_id: userId, twitch_username: username });
            await interaction.reply('Subscription started.');
        } else {
            await interaction.reply('User not found.');
        }
    } catch (error) {
        log.error({ err: error }, 'Error during Twitch subscription');
        await interaction.reply('An error occurred while processing the subscription.');
    }
}

async function handleUnsubscribe(interaction: any, {
    tables,
    log,
}: any) {
    const user_id = interaction.user.id;
    const record = await tables.Twitch_Users.findOne({ where: { user_id } });

    if (!record) {
        await interaction.reply('User is not subscribed.');
        return;
    }

    try {
        await api.setWebhook({ userId: record.twitch_id, mode: 'unsubscribe', leaseTime: 864000 }, tables.Config, log);
        await record.destroy({ force: true });
        await interaction.reply(`Unsubscribed from ${record.twitch_username}.`);
    } catch (error) {
        log.error({ err: error }, 'Error during Twitch unsubscription');
        await interaction.reply('An error occurred while processing the unsubscription.');
    }
}

export default {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('Manage Twitch webhooks subscriptions.')
        .addSubcommand((subcommand: any) => subcommand
            .setName('subscribe')
            .setDescription('Start a subscription to a Twitch user.')
            .addStringOption((option: any) => option.setName('username')
                .setDescription('The Twitch username to subscribe to.')
                .setRequired(true)))
        .addSubcommand((subcommand: any) => subcommand
            .setName('unsubscribe')
            .setDescription('End a subscription to a Twitch user.')),
    async execute(interaction: any, context: any) {
        const action = interaction.options.getSubcommand();
        switch (action) {
            case 'subscribe':
                await handleSubscribe(interaction, context);
                break;
            case 'unsubscribe':
                await handleUnsubscribe(interaction, context);
                break;
            default:
                await interaction.reply('Twitch subcommand does not exist.');
                break;
        }
    },
};
