import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface RollCallModel extends Model<InferAttributes<RollCallModel>, InferCreationAttributes<RollCallModel>> {
    username: string;
    value: number;
    timestamp: Date;
}

export default (sequelize: Sequelize) => ({
    RollCall: sequelize.define<RollCallModel>('rollcalls', {
        username: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        value: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 0,
                max: 100,
            },
        },
        timestamp: {
            type: DataTypes.DATE,
            allowNull: false,
        },
    }),
})
