'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create member_voting_configs table
        await queryInterface.createTable('member_voting_configs', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
                unique: true,
            },
            welcome_channel_id: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            voting_channel_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            approved_role_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            votes_required: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 3,
            },
            vote_duration_hours: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 24,
            },
            enabled: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
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

        // Create member_votes table
        await queryInterface.createTable('member_votes', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            vote_id: {
                type: Sequelize.STRING(8),
                allowNull: false,
                unique: true,
            },
            member_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            member_username: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            message_id: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            approve_voters: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: [],
            },
            reject_voters: {
                type: Sequelize.JSON,
                allowNull: false,
                defaultValue: [],
            },
            status: {
                type: Sequelize.ENUM('pending', 'approved', 'rejected', 'expired'),
                allowNull: false,
                defaultValue: 'pending',
            },
            expires_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            resolved_at: {
                type: Sequelize.DATE,
                allowNull: true,
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

        // Create indexes
        await queryInterface.addIndex('member_votes', ['guild_id'], {
            name: 'member_votes_guild_id_idx',
        });

        await queryInterface.addIndex('member_votes', ['member_id', 'guild_id'], {
            name: 'member_votes_member_guild_idx',
        });

        await queryInterface.addIndex('member_votes', ['status'], {
            name: 'member_votes_status_idx',
        });

        await queryInterface.addIndex('member_votes', ['vote_id'], {
            name: 'member_votes_vote_id_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        // Drop indexes first
        await queryInterface.removeIndex('member_votes', 'member_votes_guild_id_idx');
        await queryInterface.removeIndex('member_votes', 'member_votes_member_guild_idx');
        await queryInterface.removeIndex('member_votes', 'member_votes_status_idx');
        await queryInterface.removeIndex('member_votes', 'member_votes_vote_id_idx');

        // Drop tables
        await queryInterface.dropTable('member_votes');
        await queryInterface.dropTable('member_voting_configs');
    },
};
