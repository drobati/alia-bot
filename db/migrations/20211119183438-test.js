'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) =>
        await queryInterface.sequelize.transaction(
            async (transaction) =>
                await queryInterface.changeColumn(
                    'louds_banneds',
                    'username',
                    {
                        type: Sequelize.STRING,
                        allowNull: false
                    },
                    {
                        transaction
                    }
                )
        ),
    down: async (queryInterface, Sequelize) =>
        await queryInterface.sequelize.transaction(
            async (transaction) =>
                await queryInterface.changeColumn(
                    'louds_banneds',
                    'username',
                    {
                        type: Sequelize.INTEGER,
                        allowNull: false
                    },
                    {
                        transaction
                    }
                )
        )
};
