import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

export interface VerificationCodeAttributes {
    code: string;
    guildId: string;
    generatorId: string;
    roleId: string;
    used: boolean;
    usedBy?: string | null;
    usedAt?: Date | null;
    createdAt?: Date;
    updatedAt?: Date;
}

interface VerificationCodeModel extends Model<
    InferAttributes<VerificationCodeModel>,
    InferCreationAttributes<VerificationCodeModel>
> {
    code: string;
    guildId: string;
    generatorId: string;
    roleId: string;
    used: boolean;
    usedBy?: string | null;
    usedAt?: Date | null;
}

export default (sequelize: Sequelize) => ({
    VerificationCode: sequelize.define<VerificationCodeModel>('verification_codes', {
        code: {
            type: DataTypes.STRING(8),
            primaryKey: true,
            allowNull: false,
        },
        guildId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'guild_id',
        },
        generatorId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'generator_id',
        },
        roleId: {
            type: DataTypes.STRING(20),
            allowNull: false,
            field: 'role_id',
        },
        used: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
        },
        usedBy: {
            type: DataTypes.STRING(20),
            allowNull: true,
            field: 'used_by',
        },
        usedAt: {
            type: DataTypes.DATE,
            allowNull: true,
            field: 'used_at',
        },
    }, {
        timestamps: true,
        underscored: true,
    }),
});
