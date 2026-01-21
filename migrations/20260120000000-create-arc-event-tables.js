'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create arc_event_subscriptions table
        await queryInterface.createTable('arc_event_subscriptions', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord guild ID',
            },
            user_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord user ID',
            },
            username: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Cached Discord username for display',
            },
            event_types: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'JSON array of event types to track, null means all',
            },
            maps: {
                type: Sequelize.TEXT,
                allowNull: true,
                comment: 'JSON array of maps to track, null means all',
            },
            warn_minutes: {
                type: Sequelize.TEXT,
                allowNull: false,
                defaultValue: '[15]',
                comment: 'JSON array of minutes before event to warn',
            },
            notify_dm: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: false,
            },
            notify_channel: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            active: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
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

        // Create indexes for arc_event_subscriptions
        await queryInterface.addIndex('arc_event_subscriptions', ['guild_id'], {
            name: 'arc_event_subs_guild_idx',
        });
        await queryInterface.addIndex('arc_event_subscriptions', ['guild_id', 'user_id'], {
            name: 'arc_event_subs_guild_user_idx',
        });
        await queryInterface.addIndex('arc_event_subscriptions', ['guild_id', 'active'], {
            name: 'arc_event_subs_guild_active_idx',
        });
        await queryInterface.addIndex('arc_event_subscriptions', ['guild_id', 'user_id'], {
            unique: true,
            name: 'arc_event_subs_unique_user',
        });

        // Create arc_event_configs table
        await queryInterface.createTable('arc_event_configs', {
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
                comment: 'Discord guild ID',
            },
            announcement_channel_id: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'Channel ID for event announcements',
            },
            allow_channel_announcements: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
            },
            allow_dm_notifications: {
                type: Sequelize.BOOLEAN,
                allowNull: false,
                defaultValue: true,
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

        // Create index for arc_event_configs
        await queryInterface.addIndex('arc_event_configs', ['guild_id'], {
            unique: true,
            name: 'arc_event_configs_guild_unique',
        });

        // Create arc_event_notifications table to track sent notifications
        await queryInterface.createTable('arc_event_notifications', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            guild_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord guild ID',
            },
            user_id: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Discord user ID who received notification',
            },
            event_name: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'ARC event name',
            },
            event_map: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'ARC map name',
            },
            event_start_time: {
                type: Sequelize.BIGINT,
                allowNull: false,
                comment: 'Event start timestamp in ms',
            },
            warn_minutes: {
                type: Sequelize.INTEGER,
                allowNull: false,
                comment: 'Warning minutes before event',
            },
            notification_type: {
                type: Sequelize.ENUM('dm', 'channel'),
                allowNull: false,
            },
            sent_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Create indexes for arc_event_notifications
        await queryInterface.addIndex('arc_event_notifications',
            ['guild_id', 'user_id', 'event_start_time', 'warn_minutes'], {
            unique: true,
            name: 'arc_event_notif_unique',
        });
        await queryInterface.addIndex('arc_event_notifications', ['sent_at'], {
            name: 'arc_event_notif_sent_idx',
        });
    },

    async down(queryInterface) {
        // Remove indexes and drop arc_event_notifications
        await queryInterface.removeIndex('arc_event_notifications', 'arc_event_notif_unique');
        await queryInterface.removeIndex('arc_event_notifications', 'arc_event_notif_sent_idx');
        await queryInterface.dropTable('arc_event_notifications');
        // Remove indexes and drop arc_event_subscriptions
        await queryInterface.removeIndex('arc_event_subscriptions', 'arc_event_subs_guild_idx');
        await queryInterface.removeIndex('arc_event_subscriptions', 'arc_event_subs_guild_user_idx');
        await queryInterface.removeIndex('arc_event_subscriptions', 'arc_event_subs_guild_active_idx');
        await queryInterface.removeIndex('arc_event_subscriptions', 'arc_event_subs_unique_user');
        await queryInterface.dropTable('arc_event_subscriptions');

        // Remove index and drop arc_event_configs
        await queryInterface.removeIndex('arc_event_configs', 'arc_event_configs_guild_unique');
        await queryInterface.dropTable('arc_event_configs');
    },
};
