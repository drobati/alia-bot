import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface VoiceModel extends Model<InferAttributes<VoiceModel>, InferCreationAttributes<VoiceModel>> {
    name: string;
    voiceId: string;
    description: string;
}

export default (sequelize: Sequelize) => ({
    Voice: sequelize.define<VoiceModel>('voices', {
        name: {
            type: DataTypes.STRING,
            unique: true,
            allowNull: false,
        },
        voiceId: {
            type: DataTypes.STRING,
            allowNull: false,
        },
        description: {
            type: DataTypes.STRING,
            allowNull: false,
        },
    }),
})
