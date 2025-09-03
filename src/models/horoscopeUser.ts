import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

export interface HoroscopeUserAttributes {
    userId: string;
    guildId?: string;
    zodiacSign: string;
    birthDate?: string; // MM-DD format
    preferredType: string; // default: 'daily'
    lastReadDate?: Date;
    totalReads: number;
    favoriteReadings: number;
    createdAt?: Date;
    updatedAt?: Date;
}

interface HoroscopeUserModel extends Model<InferAttributes<HoroscopeUserModel>, InferCreationAttributes<HoroscopeUserModel>> {
    userId: string;
    guildId?: string;
    zodiacSign: string;
    birthDate?: string;
    preferredType: string;
    lastReadDate?: Date;
    totalReads: number;
    favoriteReadings: number;
}

export default (sequelize: Sequelize) => ({
    HoroscopeUser: sequelize.define<HoroscopeUserModel>('horoscope_users', {
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        zodiacSign: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo', 
                       'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']],
            },
        },
        birthDate: {
            type: DataTypes.STRING(5), // MM-DD format
            allowNull: true,
            validate: {
                is: /^\d{2}-\d{2}$/, // MM-DD format validation
            },
        },
        preferredType: {
            type: DataTypes.STRING(20),
            allowNull: false,
            defaultValue: 'daily',
            validate: {
                isIn: [['daily', 'weekly', 'monthly', 'love', 'career', 'lucky']],
            },
        },
        lastReadDate: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        totalReads: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        favoriteReadings: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
    }, {
        timestamps: true,
        indexes: [
            {
                unique: true,
                fields: ['userId', 'guildId'],
            },
            {
                fields: ['zodiacSign'],
            },
            {
                fields: ['lastReadDate'],
            },
        ],
    })
});