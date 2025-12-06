import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    MemberVotingConfig: sequelize.define('MemberVotingConfig', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
        },
        welcome_channel_id: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        voting_channel_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        approved_role_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        votes_required: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 3,
        },
        vote_duration_hours: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 24,
        },
        enabled: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
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
        tableName: 'member_voting_configs',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }),
});
