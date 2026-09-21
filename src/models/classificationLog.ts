import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    ClassificationLog: sequelize.define('ClassificationLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: { type: DataTypes.STRING, allowNull: false },
        channel_id: { type: DataTypes.STRING, allowNull: false },
        message_id: { type: DataTypes.STRING, allowNull: false },
        content: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Truncated. Enough to tune the taxonomy, small enough to prune cheaply.',
        },
        addressed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            comment: 'Mentioned Alia, versus picked up passively',
        },
        type: { type: DataTypes.STRING, allowNull: false },
        confidence: { type: DataTypes.FLOAT, allowNull: false },
        alternatives: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Runners-up with probabilities. The runner-up is the diagnosis.',
        },
        route: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'tool:<name>, llm or silent',
        },
        reason: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'below_floor or tool_no_answer',
        },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'classification_logs',
        timestamps: false,
    }),
});
