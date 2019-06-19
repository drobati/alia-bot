const { Sequelize } = require('sequelize');

module.exports = sequelize => {
    const Memories = sequelize.define('memories', {
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
    });

    return { Memories };
};
