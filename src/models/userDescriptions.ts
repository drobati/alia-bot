import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    UserDescriptions: sequelize.define('UserDescriptions', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'The user being described',
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        creator_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'The user who added this description',
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
        tableName: 'user_descriptions',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['guild_id', 'user_id', 'description'],
                name: 'user_descriptions_unique',
            },
            {
                fields: ['guild_id', 'user_id'],
                name: 'user_descriptions_guild_user_idx',
            },
        ],
    }),
});
