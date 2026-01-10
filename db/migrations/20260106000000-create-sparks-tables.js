'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create sparks_users table
        await queryInterface.createTable('sparks_users', {
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
            discord_id: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            username: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            hide_last_seen: {
                type: Sequelize.BOOLEAN,
                defaultValue: false,
            },
            last_seen_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_seen_channel_id: {
                type: Sequelize.STRING,
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

        // Unique constraint on guild + discord user
        await queryInterface.addIndex('sparks_users', ['guild_id', 'discord_id'], {
            unique: true,
            name: 'sparks_users_guild_discord_unique',
        });

        // Create sparks_balances table
        await queryInterface.createTable('sparks_balances', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'sparks_users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            current_balance: {
                type: Sequelize.INTEGER,
                defaultValue: 100,
                allowNull: false,
            },
            escrow_balance: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            lifetime_earned: {
                type: Sequelize.INTEGER,
                defaultValue: 100,
                allowNull: false,
            },
            lifetime_spent: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
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

        await queryInterface.addIndex('sparks_balances', ['user_id'], {
            unique: true,
            name: 'sparks_balances_user_unique',
        });

        // Create sparks_ledger table for transaction history
        await queryInterface.createTable('sparks_ledger', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'sparks_users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            type: {
                type: Sequelize.ENUM('earn', 'spend', 'escrow_in', 'escrow_out', 'refund', 'payout', 'void', 'daily_bonus'),
                allowNull: false,
            },
            amount: {
                type: Sequelize.INTEGER,
                allowNull: false,
            },
            ref_type: {
                type: Sequelize.STRING(50),
                allowNull: true,
                comment: 'Reference type: message, bet, daily_bonus, etc.',
            },
            ref_id: {
                type: Sequelize.STRING(255),
                allowNull: true,
                comment: 'Reference ID: message_id, bet_id, etc.',
            },
            description: {
                type: Sequelize.STRING(255),
                allowNull: true,
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        await queryInterface.addIndex('sparks_ledger', ['user_id', 'created_at'], {
            name: 'sparks_ledger_user_created_idx',
        });

        await queryInterface.addIndex('sparks_ledger', ['ref_type', 'ref_id'], {
            name: 'sparks_ledger_ref_idx',
        });

        // Create sparks_engagement table for rate limiting
        await queryInterface.createTable('sparks_engagement', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            user_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                references: {
                    model: 'sparks_users',
                    key: 'id',
                },
                onDelete: 'CASCADE',
            },
            daily_earn_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            daily_sparks_earned: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
            },
            last_earn_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            last_daily_bonus_at: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            recent_message_count: {
                type: Sequelize.INTEGER,
                defaultValue: 0,
                allowNull: false,
                comment: 'Messages in last 10 minutes for spam detection',
            },
            recent_message_window_start: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            suppressed_until: {
                type: Sequelize.DATE,
                allowNull: true,
                comment: 'If set, user is suppressed from earning until this time',
            },
            reset_date: {
                type: Sequelize.DATEONLY,
                allowNull: false,
                comment: 'Date when daily counters were last reset',
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

        await queryInterface.addIndex('sparks_engagement', ['user_id'], {
            unique: true,
            name: 'sparks_engagement_user_unique',
        });
    },

    async down(queryInterface) {
        // Drop in reverse order due to foreign keys
        await queryInterface.dropTable('sparks_engagement');
        await queryInterface.dropTable('sparks_ledger');
        await queryInterface.dropTable('sparks_balances');
        await queryInterface.dropTable('sparks_users');
    },
};
