import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface ConfigModel extends Model<InferAttributes<ConfigModel>, InferCreationAttributes<ConfigModel>> {
    key: string;
    value: string;
}

export default (sequelize: Sequelize) => ({
    Config: sequelize.define<ConfigModel>('configs', {
        key: {
            type: DataTypes.STRING,
            unique: true,
        },
        value: {
            type: DataTypes.STRING,
        },
    }),
})
