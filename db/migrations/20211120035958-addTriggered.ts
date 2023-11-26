'use strict';

export default {
    up: async (queryInterface: any, Sequelize: any) => {
        await queryInterface.sequelize.transaction(
            async (transaction: any) => await queryInterface.addColumn(
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

    down: async (queryInterface: any) => {
        await queryInterface.sequelize.transaction(
            async (transaction: any) => await queryInterface.removeColumn('memories', 'triggered', { transaction }),
        );
    },
};
