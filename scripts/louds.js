module.exports = {
    listenForLouds: function(message) {
        const regex = /fear/;

        if (regex.test(message.content)) {
            // send back "Pong." to the channel the message was sent in
            message.channel.send('Fear is the mindkiller.');
        }
    },
};
