const axios = require('axios');

module.exports = async (message) => {
    try {
        const {
            data: { joke }
        } = await axios.get('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json', 'User-Agent': 'fuckicanhazdadjoke' }
        });
        message.channel.send(joke);
    } catch (error) {
        console.log(error);
        message.channel.send('There was an error.');
    }
};
