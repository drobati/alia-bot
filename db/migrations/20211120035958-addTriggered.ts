'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        await queryInterface.sequelize.transaction(
            async transaction =>
                await queryInterface.addColumn(
                    'memories',
                    'triggered',
                    {
                        type: Sequelize.BOOLEAN,
                        defaultValue: false,
                        allowNull: false,
                    },
                    {
                        transaction,
                    },
                ),
        );
    },

    down: async queryInterface => {
        await queryInterface.sequelize.transaction(
            async transaction =>
                await queryInterface.removeColumn('memories', 'triggered', { transaction }),
        );
    },
};
