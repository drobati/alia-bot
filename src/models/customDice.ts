import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    CustomDice: sequelize.define('CustomDice', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(50),
            allowNull: false,
        },
        sides: {
            type: DataTypes.TEXT,
            allowNull: false,
            comment: 'JSON array of side values',
        },
        creator_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'custom_dice',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['guild_id', 'name'],
                name: 'custom_dice_guild_name_unique',
            },
        ],
    }),
});
