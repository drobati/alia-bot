import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface LoudsModel extends Model<InferAttributes<LoudsModel>, InferCreationAttributes<LoudsModel>> {
    message: string;
    username: string;
    usage_count: number;
}

interface LoudsBannedModel extends Model<InferAttributes<LoudsBannedModel>, InferCreationAttributes<LoudsBannedModel>> {
    message: string;
    username: string;
}

export default (sequelize: Sequelize) => ({
    Louds: sequelize.define<LoudsModel>('louds', {
        message: {
            type: DataTypes.STRING,
            unique: true,
        },
        // username is a snowflake
        username: DataTypes.STRING,
        usage_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
    }),
    Louds_Banned: sequelize.define<LoudsBannedModel>('louds_banned', {
        message: {
            type: DataTypes.STRING,
            unique: true,
        },
        username: DataTypes.STRING,
    }),
})
