const { SlashCommandBuilder } = require('discord.js');
const api = require('../lib/apis/twitch'); // Ensure this path is correct

async function handleSubscribe(interaction, { tables, log }) {
    const username = interaction.options.getString('username');
    const user_id = interaction.user.id;
    const record = await tables.Twitch_Users.findOne({ where: { user_id } });

    if (record) {
        await interaction.reply('User is already registered.');
        return;
    }

    try {
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

async function handleUnsubscribe(interaction, { tables, log }) {
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

module.exports = {
    data: new SlashCommandBuilder()
        .setName('twitch')
        .setDescription('Manage Twitch webhooks subscriptions.')
        .addSubcommand(subcommand =>
            subcommand
                .setName('subscribe')
                .setDescription('Start a subscription to a Twitch user.')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('The Twitch username to subscribe to.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('unsubscribe')
                .setDescription('End a subscription to a Twitch user.')),
    async execute(interaction, context) {
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
    }
};
