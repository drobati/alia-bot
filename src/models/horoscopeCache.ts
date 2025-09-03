import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

export interface HoroscopeCacheAttributes {
    cacheKey: string;
    sign: string;
    type: string;
    period: string;
    content: string;
    luckyNumbers: string;
    luckyColor: string;
    compatibility: string;
    mood: string;
    expiresAt: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

interface HoroscopeCacheModel extends Model<
    InferAttributes<HoroscopeCacheModel>,
    InferCreationAttributes<HoroscopeCacheModel>
> {
    cacheKey: string;
    sign: string;
    type: string;
    period: string;
    content: string;
    luckyNumbers: string;
    luckyColor: string;
    compatibility: string;
    mood: string;
    expiresAt: Date;
}

export default (sequelize: Sequelize) => ({
    HoroscopeCache: sequelize.define<HoroscopeCacheModel>('horoscope_cache', {
        cacheKey: {
            type: DataTypes.STRING,
            primaryKey: true,
            allowNull: false,
        },
        sign: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['aries', 'taurus', 'gemini', 'cancer', 'leo', 'virgo',
                    'libra', 'scorpio', 'sagittarius', 'capricorn', 'aquarius', 'pisces']],
            },
        },
        type: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['daily', 'weekly', 'monthly', 'love', 'career', 'lucky']],
            },
        },
        period: {
            type: DataTypes.STRING(20),
            allowNull: false,
            validate: {
                isIn: [['today', 'tomorrow', 'this-week', 'next-week', 'this-month']],
            },
        },
        content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        luckyNumbers: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        luckyColor: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        compatibility: {
            type: DataTypes.STRING(100),
            allowNull: false,
            defaultValue: '',
        },
        mood: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        expiresAt: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }, {
        timestamps: true,
        indexes: [
            {
                fields: ['expiresAt'],
            },
            {
                fields: ['sign', 'type', 'period'],
            },
        ],
    }),
});