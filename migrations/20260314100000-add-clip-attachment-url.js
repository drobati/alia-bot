'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.addColumn('clips', 'attachment_url', {
            type: Sequelize.STRING(2048),
            allowNull: true,
            defaultValue: null,
        });
    },

    async down(queryInterface) {
        await queryInterface.removeColumn('clips', 'attachment_url');
    },
};
