'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create horoscope_users table
        await queryInterface.createTable('horoscope_users', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            userId: {
                type: Sequelize.STRING,
                allowNull: false,
            },
            guildId: {
                type: Sequelize.STRING,
                allowNull: true,
            },
            zodiacSign: {
                type: Sequelize.STRING(20),
                allowNull: false,
                validate: {
                    isIn: [['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                           'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']],
                },
            },
            birthDate: {
                type: Sequelize.STRING(5), // MM-DD format
                allowNull: true,
                validate: {
                    is: /^\d{2}-\d{2}$/, // MM-DD format validation
                },
            },
            preferredType: {
                type: Sequelize.STRING(20),
                allowNull: false,
                defaultValue: 'daily',
                validate: {
                    isIn: [['daily', 'weekly', 'monthly', 'love', 'career', 'lucky']],
                },
            },
            lastReadDate: {
                type: Sequelize.DATE,
                allowNull: true,
            },
            totalReads: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            favoriteReadings: {
                type: Sequelize.INTEGER,
                allowNull: false,
                defaultValue: 0,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Create horoscope_cache table
        await queryInterface.createTable('horoscope_cache', {
            cacheKey: {
                type: Sequelize.STRING,
                primaryKey: true,
                allowNull: false,
            },
            sign: {
                type: Sequelize.STRING(20),
                allowNull: false,
                validate: {
                    isIn: [['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                           'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']],
                },
            },
            type: {
                type: Sequelize.STRING(20),
                allowNull: false,
                validate: {
                    isIn: [['daily', 'weekly', 'monthly', 'love', 'career', 'lucky']],
                },
            },
            period: {
                type: Sequelize.STRING(20),
                allowNull: false,
                validate: {
                    isIn: [['today', 'tomorrow', 'this-week', 'next-week', 'this-month']],
                },
            },
            content: {
                type: Sequelize.TEXT,
                allowNull: false,
            },
            luckyNumbers: {
                type: Sequelize.STRING(50),
                allowNull: false,
            },
            luckyColor: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            compatibility: {
                type: Sequelize.STRING(100),
                allowNull: false,
                defaultValue: '',
            },
            mood: {
                type: Sequelize.STRING(100),
                allowNull: false,
            },
            expiresAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            createdAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updatedAt: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Create indexes for horoscope_users
        await queryInterface.addIndex('horoscope_users', ['userId', 'guildId'], {
            unique: true,
            name: 'horoscope_users_user_guild_unique',
        });

        await queryInterface.addIndex('horoscope_users', ['zodiacSign'], {
            name: 'horoscope_users_zodiac_sign_idx',
        });

        await queryInterface.addIndex('horoscope_users', ['lastReadDate'], {
            name: 'horoscope_users_last_read_date_idx',
        });

        // Create indexes for horoscope_cache
        await queryInterface.addIndex('horoscope_cache', ['expiresAt'], {
            name: 'horoscope_cache_expires_at_idx',
        });

        await queryInterface.addIndex('horoscope_cache', ['sign', 'type', 'period'], {
            name: 'horoscope_cache_sign_type_period_idx',
        });
    },

    async down(queryInterface, Sequelize) {
        // Drop indexes first
        await queryInterface.removeIndex('horoscope_users', 'horoscope_users_user_guild_unique');
        await queryInterface.removeIndex('horoscope_users', 'horoscope_users_zodiac_sign_idx');
        await queryInterface.removeIndex('horoscope_users', 'horoscope_users_last_read_date_idx');
        await queryInterface.removeIndex('horoscope_cache', 'horoscope_cache_expires_at_idx');
        await queryInterface.removeIndex('horoscope_cache', 'horoscope_cache_sign_type_period_idx');

        // Drop tables
        await queryInterface.dropTable('horoscope_cache');
        await queryInterface.dropTable('horoscope_users');
    },
};