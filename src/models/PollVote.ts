import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    PollVote: sequelize.define('PollVote', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        poll_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        option_index: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        voted_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'poll_votes',
        timestamps: false,
        indexes: [
            {
                unique: true,
                fields: ['poll_id', 'user_id'],
            },
        ],
    }),
});