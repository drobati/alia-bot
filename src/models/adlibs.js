const { Sequelize } = require('sequelize');

module.exports = (sequelize) => {
    return sequelize.define('adlib', {
        value: {
            type: Sequelize.STRING,
            unique: true
        }
    });
};
