import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface BetBalancesModel extends Model<InferAttributes<BetBalancesModel>, InferCreationAttributes<BetBalancesModel>> {
    user_id: number;
    current_balance: number;
    escrow_balance: number;
    lifetime_earned: number;
    lifetime_spent: number;
    created_at?: Date;
    updated_at?: Date;
}

export default (sequelize: Sequelize) => ({
    BetBalances: sequelize.define<BetBalancesModel>('bet_balances', {
        user_id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            allowNull: false,
            references: {
                model: 'bet_users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        current_balance: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 100,
            validate: {
                min: 0,
            },
        },
        escrow_balance: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
            },
        },
        lifetime_earned: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
            },
        },
        lifetime_spent: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
            },
        },
        created_at: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'created_at',
        },
        updated_at: {
            type: DataTypes.DATE,
            allowNull: false,
            field: 'updated_at',
        },
    }, {
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['user_id'],
                name: 'bet_balances_user_id_idx',
            },
            {
                fields: ['user_id', 'updated_at'],
                name: 'bet_balances_user_updated_idx',
            },
            {
                fields: ['current_balance'],
                name: 'bet_balances_current_balance_idx',
            },
        ],
    }),
});