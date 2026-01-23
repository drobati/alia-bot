'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface) {
        // Add new ENUM values for tribute transactions
        // MySQL requires altering the column to modify ENUM values
        await queryInterface.sequelize.query(`
            ALTER TABLE spice_ledger
            MODIFY COLUMN type ENUM(
                'harvest',
                'give_sent',
                'give_received',
                'tribute_paid',
                'tribute_received'
            ) NOT NULL
        `);
    },

    async down(queryInterface) {
        // Revert to original ENUM values
        // Note: This will fail if there are any records with tribute_paid or tribute_received
        await queryInterface.sequelize.query(`
            ALTER TABLE spice_ledger
            MODIFY COLUMN type ENUM(
                'harvest',
                'give_sent',
                'give_received'
            ) NOT NULL
        `);
    },
};
