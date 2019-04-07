const hapi = require('hapi');

module.exports = async () => {
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

    await server.start();

    console.log('Server running at:', server.info.uri);
};
