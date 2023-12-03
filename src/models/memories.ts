import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface MemoriesModel extends Model<InferAttributes<MemoriesModel>, InferCreationAttributes<MemoriesModel>> {
    key: string;
    value: string;
    username: string;
    read_count: number;
    triggered: boolean;
}

export default (sequelize: Sequelize) => ({
    Memories: sequelize.define<MemoriesModel>('memories', {
        key: {
            type: DataTypes.STRING,
            unique: true,
        },
        value: DataTypes.STRING,
        username: DataTypes.STRING,
        read_count: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        triggered: {
            type: DataTypes.BOOLEAN,
            defaultValue: false,
            allowNull: false,
        },
    }),
})
