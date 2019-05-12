const { Sequelize } = require('sequelize');

module.exports = sequelize => {
    const Twitch_Users = sequelize.define('twitch_users', {
        user_id: {
            type: Sequelize.STRING,
            unique: true,
        },
        twitch_id: {
            type: Sequelize.STRING,
            unique: true,
        },
    });

    const Twitch_Notifications = sequelize.define('twitch_notifications', {
        notification_id: {
            type: Sequelize.INTEGER,
            unique: true,
        },
    });

    return { Twitch_Users, Twitch_Notifications };
};
