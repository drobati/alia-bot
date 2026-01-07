import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    SparksEngagement: sequelize.define('SparksEngagement', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'sparks_users',
                key: 'id',
            },
        },
        daily_earn_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        daily_sparks_earned: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        last_earn_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        last_daily_bonus_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        recent_message_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
            comment: 'Messages in last 10 minutes for spam detection',
        },
        recent_message_window_start: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        suppressed_until: {
            type: DataTypes.DATE,
            allowNull: true,
            comment: 'If set, user is suppressed from earning until this time',
        },
        reset_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            comment: 'Date when daily counters were last reset',
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
        tableName: 'sparks_engagement',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['user_id'],
                name: 'sparks_engagement_user_unique',
            },
        ],
    }),
});
