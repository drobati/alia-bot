import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    MemberVote: sequelize.define('MemberVote', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        vote_id: {
            type: DataTypes.STRING(8),
            allowNull: false,
            unique: true,
        },
        member_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        member_username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        message_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        approve_voters: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        reject_voters: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        status: {
            type: DataTypes.ENUM('pending', 'approved', 'rejected', 'expired'),
            allowNull: false,
            defaultValue: 'pending',
        },
        expires_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        resolved_at: {
            type: DataTypes.DATE,
            allowNull: true,
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
        tableName: 'member_votes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['guild_id'],
            },
            {
                fields: ['member_id', 'guild_id'],
            },
            {
                fields: ['status'],
            },
        ],
    }),
});
