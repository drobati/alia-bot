const { Sequelize } = require('sequelize');

module.exports = (sequelize) => ({
    Adlibs: sequelize.define('adlib', {
        value: {
            type: Sequelize.STRING,
            unique: true
        }
    })
});
