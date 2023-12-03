'use strict';

export default {
    up: async (queryInterface: any, Sequelize: any) =>
        await queryInterface.sequelize.transaction(
            async (transaction: any) => await queryInterface.changeColumn(
                'louds_banneds',
                'username',
                {
                    type: Sequelize.STRING,
                    allowNull: false,
                },
                {
                    transaction,
                },
            ),
        ),
    down: async (queryInterface: any, Sequelize: any) =>
        await queryInterface.sequelize.transaction(
            async (transaction: any) => await queryInterface.changeColumn(
                'louds_banneds',
                'username',
                {
                    type: Sequelize.INTEGER,
                    allowNull: false,
                },
                {
                    transaction,
                },
            ),
        ),
};
