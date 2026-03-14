'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('clips', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            channel_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            message_author_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_author_username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            clipped_by_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            clipped_by_username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_timestamp: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            created_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('NOW'),
            },
            updated_at: {
                type: Sequelize.DATE,
                defaultValue: Sequelize.fn('NOW'),
            },
        });

        await queryInterface.addIndex('clips', ['guild_id', 'message_id'], {
            unique: true,
            name: 'clips_guild_message_unique',
        });
        await queryInterface.addIndex('clips', ['guild_id', 'message_author_id'], {
            name: 'clips_guild_author',
        });
        await queryInterface.addIndex('clips', ['guild_id'], {
            name: 'clips_guild',
        });
    },

    async down(queryInterface) {
        await queryInterface.dropTable('clips');
    },
};
