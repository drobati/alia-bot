const { SlashCommandBuilder } = require('discord.js');
const api = require('../lib/apis/twitch'); // Ensure this path is correct

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
                .setDescription('End a subscription to a Twitch user.')
                .addStringOption(option =>
                    option.setName('username')
                        .setDescription('The Twitch username to unsubscribe from.')
                        .setRequired(true)))
        .addSubcommand(subcommand =>
            subcommand
                .setName('list')
                .setDescription('List your current Twitch subscriptions.')),
    async execute(interaction, { Twitch_Users, Config, log }) {
        const leaseTime = 864000;
        const action = interaction.options.getSubcommand();
        const username = interaction.options.getString('username'); // Only needed for subscribe/unsubscribe

        const user_id = interaction.user.id;
        const record = await Twitch_Users.findOne({ where: { user_id } });

        switch (action) {
            case 'subscribe':
                if (record) {
                    await interaction.reply('User is already registered.');
                } else {
                    try {
                        const userId = await api.getUserId(username, Config);
                        if (userId) {
                            await api.setWebhook({ userId, mode: 'subscribe', leaseTime }, Config, log);
                            await Twitch_Users.create({ user_id, twitch_id: userId });
                            await interaction.reply('Subscription started.');
                        } else {
                            await interaction.reply('User not found.');
                        }
                    } catch (error) {
                        log.error({ err: error }, 'Error during Twitch subscription');
                        await interaction.reply('An error occurred while processing the subscription.');
                    }
                }
                break;

            case 'unsubscribe':
                if (record) {
                    const userId = record.twitch_id;
                    await api.setWebhook({ userId, mode: 'unsubscribe', leaseTime }, Config, log);
                    await record.destroy({ force: true });
                    await interaction.reply('Unsubscription started.');
                } else {
                    await interaction.reply('User is not subscribed.');
                }
                break;

            case 'list':
                // Handle the 'list' subcommand as needed
                await interaction.reply('This feature is not implemented yet.');
                break;

            default:
                await interaction.reply('Twitch subcommand does not exist.');
                break;
        }
    }
};
