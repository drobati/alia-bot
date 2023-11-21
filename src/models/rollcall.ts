const { DataTypes } = require('sequelize');

module.exports = sequelize => ({
    RollCall: sequelize.define('rollcalls', {
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        value: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 0,
                max: 100,
            },
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }),
});
