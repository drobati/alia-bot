'use strict';

module.exports = {
    up: async (queryInterface, Sequelize) => {
        // Check if column already exists (idempotent migration)
        const tableDescription = await queryInterface.describeTable('memories');
        if (tableDescription.triggered) {
            console.log('Column "triggered" already exists, skipping...');
            return;
        }

        await queryInterface.addColumn('memories', 'triggered', {
            type: Sequelize.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        });
    },

    down: async (queryInterface) => {
        await queryInterface.removeColumn('memories', 'triggered');
    },
};
