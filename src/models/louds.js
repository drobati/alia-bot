const { Sequelize } = require('sequelize');

module.exports = (sequelize) => ({
    Louds: sequelize.define('louds', {
        message: {
            type: Sequelize.STRING,
            unique: true
        },
        // username is a snowflake
        username: Sequelize.STRING,
        usage_count: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false
        }
    }),
    Louds_Banned: sequelize.define('louds_banned', {
        message: {
            type: Sequelize.STRING,
            unique: true
        },
        username: Sequelize.STRING
    })
});
