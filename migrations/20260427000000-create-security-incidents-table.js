'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('security_incidents', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'The user who was actioned',
            },
            reason: {
                type: Sequelize.STRING(255),
                allowNull: false,
                comment: 'Why this incident triggered (e.g. cross_channel_duplicate)',
            },
            content_hash: {
                type: Sequelize.STRING(64),
                allowNull: false,
            },
            channels_seen: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'JSON array of channel IDs the message appeared in',
            },
            roles_snapshot: {
                type: Sequelize.TEXT,
                allowNull: false,
                comment: 'JSON array of role IDs the user had before being stripped',
            },
            action_taken: {
                type: Sequelize.STRING(64),
                allowNull: false,
                defaultValue: 'pending',
                comment: 'pending | actioned | dry_run | skipped_admin | failed',
            },
            details: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'Optional JSON with extra details / error info',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('security_incidents', ['guild_id', 'user_id'], {
            name: 'security_incidents_guild_user_idx',
        });

        await queryInterface.addIndex('security_incidents', ['guild_id', 'created_at'], {
            name: 'security_incidents_guild_time_idx',
        });
    },

    async down(queryInterface) {
        await queryInterface.removeIndex('security_incidents', 'security_incidents_guild_user_idx');
        await queryInterface.removeIndex('security_incidents', 'security_incidents_guild_time_idx');
        await queryInterface.dropTable('security_incidents');
    },
};
