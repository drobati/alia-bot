import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

export interface DndGameAttributes {
    id?: number;
    guildId: string;
    name: string;
    systemPrompt: string;
    conversationHistory: Array<{ role: string; content: string }>;
    channelId?: string;
    isActive: boolean;
    waitPeriodMinutes: number;
    currentRound: number;
    pendingMessages: Array<{ userId: string; username: string; content: string; timestamp: Date }>;
    lastResponseTime?: Date;
    createdAt?: Date;
    updatedAt?: Date;
}

interface DndGameModel extends Model<
    InferAttributes<DndGameModel>,
    InferCreationAttributes<DndGameModel>
> {
    id?: number;
    guildId: string;
    name: string;
    systemPrompt: string;
    conversationHistory: Array<{ role: string; content: string }>;
    channelId?: string;
    isActive: boolean;
    waitPeriodMinutes: number;
    currentRound: number;
    pendingMessages: Array<{ userId: string; username: string; content: string; timestamp: Date }>;
    lastResponseTime?: Date;
}

export default (sequelize: Sequelize) => ({
    DndGame: sequelize.define<DndGameModel>('dnd_games', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        name: {
            type: DataTypes.STRING(100),
            allowNull: false,
        },
        systemPrompt: {
            type: DataTypes.TEXT,
            allowNull: false,
        },
        conversationHistory: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        channelId: {
            type: DataTypes.STRING,
            allowNull: true,
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        waitPeriodMinutes: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 5,
        },
        currentRound: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
        },
        pendingMessages: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
        },
        lastResponseTime: {
            type: DataTypes.DATE,
            allowNull: true,
        },
    }, {
        timestamps: true,
        indexes: [
            {
                fields: ['guildId'],
            },
            {
                unique: true,
                fields: ['guildId', 'name'],
            },
            {
                fields: ['guildId', 'isActive'],
            },
            {
                fields: ['channelId'],
            },
        ],
    }),
});
