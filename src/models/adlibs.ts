import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface AdlibsModel extends Model<InferAttributes<AdlibsModel>, InferCreationAttributes<AdlibsModel>> {
    value: string;
}

export default (sequelize: Sequelize) => ({
    Adlibs: sequelize.define<AdlibsModel>('adlib', {
        value: {
            type: DataTypes.STRING,
            unique: true,
        },
    }),
})
