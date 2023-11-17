const { Sequelize } = require('sequelize');

module.exports = sequelize => ({
    Twitch_Users: sequelize.define('twitch_users', {
        user_id: {
            type: Sequelize.STRING,
            unique: true,
        },
        twitch_id: {
            type: Sequelize.STRING,
            unique: true,
        },
        twitch_username: {
            type: Sequelize.STRING,
            unique: true,
        },
    }),
    Twitch_Notifications: sequelize.define('twitch_notifications', {
        notification_id: {
            type: Sequelize.INTEGER,
            unique: true,
        },
    }),
});
