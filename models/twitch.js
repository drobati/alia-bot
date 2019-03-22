const { Sequelize } = require('sequelize');

module.exports = sequelize => {
    const Twitch = sequelize.define('twitch', {
        user_id: {
            type: Sequelize.INTEGER,
            unique: true,
        },
        twtich_id: {
            type: Sequelize.STRING,
            unique: true,
        },
    });

    return Twitch;
};
