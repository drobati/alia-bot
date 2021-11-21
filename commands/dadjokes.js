const axios = require('axios');
const { get } = require('lodash');

module.exports = async (message) => {
    const joke = get(
        // We have to return a different useragent, otherwise the server will block us
        await axios.get('https://icanhazdadjoke.com/', {
            headers: { Accept: 'application/json', 'User-Agent': 'fuckicanhazdadjoke' }
        }),
        'data.joke'
    );
    return await message.channel.send(joke);
};
