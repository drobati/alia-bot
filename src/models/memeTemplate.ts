import { DataTypes, Sequelize } from 'sequelize';

export default function (sequelize: Sequelize) {
    const MemeTemplate = sequelize.define('MemeTemplate', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
            unique: true,
        },
        url: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        description: {
            type: DataTypes.TEXT,
            allowNull: true,
        },
        text_positions: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        default_font_size: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 40,
        },
        creator: {
            type: DataTypes.STRING(100),
            allowNull: true,
        },
        usage_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    }, {
        tableName: 'meme_templates',
        timestamps: true,
        indexes: [
            {
                fields: ['name'],
            },
            {
                fields: ['is_active'],
            },
            {
                fields: ['usage_count'],
            },
        ],
    });

    return { MemeTemplate };
}