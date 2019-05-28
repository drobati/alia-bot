// To set twitch webhooks up for users.
// Commands:
//   twitch subscribe
//   twitch unsubscribe
//   twitch list
const api = require('../lib/apis/twitch');

module.exports = async (message, commandArgs, model) => {
    const leaseTime = 864000;

    const splitArgs = commandArgs.split(' ');
    const action = splitArgs.shift();
    const username = splitArgs.shift();

    const { Twitch_Users, Config } = model;

    const record = await Twitch_Users.findOne({ where: { user_id: message.author.id } });

    switch (action) {
        case 'subscribe':
            if (!record) {
                try {
                    const userId = await api.getUserId(username, Config);
                    if (userId) {
                        await api.setWebhook({ userId, mode: 'subscribe', leaseTime }, Config);
                        await Twitch_Users.create({
                            user_id: message.author.id,
                            twitch_id: userId,
                        });
                        return message.reply('Subscription started.');
                    } else {
                        return message.reply('User is not found.');
                    }
                } catch (error) {
                    if (error) {
                        if (error.code === 1) {
                            return message.reply(error.message);
                        }
                    }
                    return message.reply('I had a really bad error.');
                }
            }
            return message.reply('User is already registered.');

        case 'unsubscribe':
            if (record) {
                const userId = record.twitch_id;
                api.setWebhook({ userId, mode: 'unsubscribe', leaseTime }, Config);
                record.destroy({ force: true });
                return message.reply('Unsubscription started.');
            }
            return message.reply('User is not subscribed.');

        default:
            return message.reply('Twitch subcommand does not exist.');
    }
};
