// To set twitch webhooks up for users.
// Commands:
//   twitch subscribe
//   twitch unsubscribe
//   twitch list
const api = require('../lib/apis/twitch');

module.exports = async (message, Twitch_Users, Config) => {
    const leaseTime = 864000;

    const words = message.content.split(' ').splice(1);
    const action = words.shift();
    const username = words.shift();

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
                            twitch_id: userId
                        });
                        return message.channel.send('Subscription started.');
                    } else {
                        return message.channel.send('User is not found.');
                    }
                } catch (error) {
                    if (error) {
                        if (error.code === 1) {
                            return message.channel.send(error.message);
                        }
                    }
                    return message.channel.send('I had a really bad error.');
                }
            }
            return message.channel.send('User is already registered.');

        case 'unsubscribe':
            if (record) {
                const userId = record.twitch_id;
                await api.setWebhook({ userId, mode: 'unsubscribe', leaseTime }, Config);
                record.destroy({ force: true });
                return message.channel.send('Unsubscription started.');
            }
            return message.channel.send('User is not subscribed.');

        default:
            return message.channel.send('Twitch subcommand does not exist.');
    }
};
