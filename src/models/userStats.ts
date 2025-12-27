import {
    DataTypes,
    Model,
    Sequelize,
    InferAttributes,
    InferCreationAttributes,
    CreationOptional,
} from "sequelize";

type UserStatsModelAttributes = InferAttributes<UserStatsModel>;
type UserStatsModelCreation = InferCreationAttributes<UserStatsModel>;

export interface UserStatsModel extends Model<UserStatsModelAttributes, UserStatsModelCreation> {
    id: CreationOptional<number>;
    guildId: string;
    userId: string;
    username: string;
    messageCount: number;
    commandCount: number;
    lastActive: Date;
    firstSeen: CreationOptional<Date>;
}

export default (sequelize: Sequelize) => ({
    UserStats: sequelize.define<UserStatsModel>('user_stats', {
        id: {
            type: DataTypes.INTEGER,
            autoIncrement: true,
            primaryKey: true,
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        userId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        messageCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        commandCount: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        lastActive: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        firstSeen: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
    }, {
        indexes: [
            {
                unique: true,
                fields: ['guildId', 'userId'],
            },
            {
                fields: ['guildId', 'messageCount'],
            },
            {
                fields: ['guildId', 'lastActive'],
            },
        ],
    }),
});
