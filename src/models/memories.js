const { Sequelize } = require('sequelize');

module.exports = sequelize => ({
    Memories: sequelize.define('memories', {
        key: {
            type: Sequelize.STRING,
            unique: true,
        },
        value: Sequelize.STRING,
        username: Sequelize.STRING,
        read_count: {
            type: Sequelize.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        triggered: {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
    }),
});
