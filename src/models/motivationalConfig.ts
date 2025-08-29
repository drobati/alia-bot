import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes, CreationOptional } from "sequelize";

interface MotivationalConfigModel extends Model<
    InferAttributes<MotivationalConfigModel>,
    InferCreationAttributes<MotivationalConfigModel>
> {
    id: CreationOptional<number>;
    channelId: string;
    guildId: string;
    frequency: 'daily' | 'weekly';
    category: 'motivation' | 'productivity' | 'general';
    cronSchedule: string;
    isActive: boolean;
    createdAt: CreationOptional<Date>;
    updatedAt: CreationOptional<Date>;
}

export default (sequelize: Sequelize) => ({
    MotivationalConfig: sequelize.define<MotivationalConfigModel>('motivational_configs', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        channelId: {
            type: DataTypes.STRING,
            allowNull: false,
            unique: true,
            field: 'channel_id',
        },
        guildId: {
            type: DataTypes.STRING,
            allowNull: false,
            field: 'guild_id',
        },
        frequency: {
            type: DataTypes.ENUM('daily', 'weekly'),
            allowNull: false,
            defaultValue: 'daily',
        },
        category: {
            type: DataTypes.ENUM('motivation', 'productivity', 'general'),
            allowNull: false,
            defaultValue: 'motivation',
        },
        cronSchedule: {
            type: DataTypes.STRING,
            allowNull: false,
            defaultValue: '0 9 * * *',
            field: 'cron_schedule',
        },
        isActive: {
            type: DataTypes.BOOLEAN,
            defaultValue: true,
            field: 'is_active',
        },
        createdAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'created_at',
        },
        updatedAt: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
            field: 'updated_at',
        },
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
    }),
})