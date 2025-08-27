import { DataTypes } from 'sequelize';

export default (sequelize: any) => {
    const Poll = sequelize.define('Poll', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        message_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        channel_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        creator_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        question: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        options: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        is_active: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
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
        tableName: 'polls',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    });

    return Poll;
};