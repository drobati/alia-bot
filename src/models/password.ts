import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

export interface PasswordAttributes {
    id?: number;
    guildId: string;
    channelId: string;
    roleId: string;
    password: string;
    createdBy: string;
    active: boolean;
    createdAt?: Date;
    updatedAt?: Date;
}

interface PasswordModel extends Model<
    InferAttributes<PasswordModel>,
    InferCreationAttributes<PasswordModel>
> {
    id: number;
    guildId: string;
    channelId: string;
    roleId: string;
    password: string;
    createdBy: string;
    active: boolean;
}

export default (sequelize: Sequelize) => ({
    Password: sequelize.define<PasswordModel>('passwords', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        guildId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'guild_id',
        },
        channelId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'channel_id',
        },
        roleId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'role_id',
        },
        password: {
            type: DataTypes.STRING(255),
            allowNull: false,
        },
        createdBy: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'created_by',
        },
        active: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: true,
        },
    }, {
        timestamps: true,
        underscored: true,
        indexes: [
            {
                fields: ['guild_id', 'channel_id', 'active'],
            },
            {
                fields: ['guild_id', 'active'],
            },
        ],
    }),
});
