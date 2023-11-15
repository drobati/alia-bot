const { Sequelize } = require('sequelize');

module.exports = (sequelize) => ({
    Config: sequelize.define('configs', {
        key: {
            type: Sequelize.STRING,
            unique: true
        },
        value: {
            type: Sequelize.STRING
        }
    }),
});
