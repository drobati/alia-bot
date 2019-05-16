const hapi = require('hapi');

module.exports = async (client, channel, embed, model) => {
    const { Twitch_Users, Twitch_Notifications } = model;
    const server = hapi.server({
        port: 8000,
    });

    // TODO: Add support for secret verification.
    server.route({
        method: 'GET',
        path: '/api/webhook',
        handler: (request, h) => {
            const challenge = request.query['hub.challenge'];
            console.log(challenge);
            h.response('success').code(200);
            return challenge;
        },
    });

    server.route({
        method: 'POST',
        path: '/api/webhook',
        handler: async (request, h) => {
            if (request.payload.data) {
                console.log(request.payload.data);
                const data = request.payload.data[0];
                // const username = request.payload.data[0].user_name;
                const id = request.payload.data[0].id;
                const notification = await Twitch_Notifications.findOne({
                    where: { notification_id: id },
                });
                if (!notification) {
                    await Twitch_Notifications.create({ notification_id: id });
                    const user = await Twitch_Users.findOne({
                        where: { twitch_id: request.payload.data[0].user_id },
                    });
                    if (user) {
                        h.response('success').code(200);
                        const discord_user = client.users.get(user.user_id.toString());
                        console.log(discord_user);
                        return channel.send(
                            embed
                                .setColor('#0099ff')
                                .setTitle(data.title)
                                .setURL('https://www.twitch.tv/' + data.user_name)
                                .setDescription(`${discord_user} is ${data.type}`)
                        );
                    }
                    h.response('success').code(200);
                    return channel.send(`Unknown discord user for ${data.user_name} on twitch.`);
                }
                // Duplicate message do nothing.
            }
            h.response('success').code(200);
            return '';
        },
    });

    await server.start();

    console.log('Server running at:', server.info.uri);
};
