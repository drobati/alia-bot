const { Sequelize } = require('sequelize');

module.exports = sequelize => {
    return sequelize.define('configs', {
        key: {
            type: Sequelize.STRING,
            unique: true,
        },
        value: {
            type: Sequelize.STRING,
        },
    });
};
