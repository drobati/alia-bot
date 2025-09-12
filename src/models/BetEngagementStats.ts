import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface BetEngagementStatsModel extends Model<
    InferAttributes<BetEngagementStatsModel>,
    InferCreationAttributes<BetEngagementStatsModel>
> {
    user_id: number;
    message_count: number;
    last_message_at?: Date | null;
    last_message_channel_id?: string | null;
    daily_earn_count: number;
    last_earn_at?: Date | null;
    last_reset_date: string; // Date string in YYYY-MM-DD format
    created_at?: Date;
    updated_at?: Date;
}

export default (sequelize: Sequelize) => ({
    BetEngagementStats: sequelize.define<BetEngagementStatsModel>('bet_engagement_stats', {
        user_id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            allowNull: false,
            references: {
                model: 'bet_users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        message_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
            },
        },
        last_message_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        last_message_channel_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        daily_earn_count: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
                max: 25, // Daily earning cap
            },
        },
        last_earn_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        last_reset_date: {
            type: DataTypes.DATEONLY,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'created_at',
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'updated_at',
        },
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['last_message_at'],
                name: 'bet_engagement_last_message_idx',
            },
            {
                fields: ['last_reset_date', 'daily_earn_count'],
                name: 'bet_engagement_daily_reset_idx',
            },
            {
                fields: ['last_earn_at'],
                name: 'bet_engagement_last_earn_idx',
            },
        ],
    }),
});