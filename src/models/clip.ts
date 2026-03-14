import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    Clip: sequelize.define('Clip', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        channel_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_content: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        message_author_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_author_username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        clipped_by_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        clipped_by_username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_timestamp: {
            type: DataTypes.DATE,
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
        tableName: 'clips',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['guild_id', 'message_id'],
                name: 'clips_guild_message_unique',
            },
            {
                fields: ['guild_id', 'message_author_id'],
                name: 'clips_guild_author',
            },
            {
                fields: ['guild_id'],
                name: 'clips_guild',
            },
        ],
    }),
});
