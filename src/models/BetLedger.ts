import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

type TransactionType = 'earn' | 'spend' | 'escrow_in' | 'escrow_out' | 'refund' | 'payout' | 'void';

interface BetLedgerModel extends Model<InferAttributes<BetLedgerModel>, InferCreationAttributes<BetLedgerModel>> {
    id: number;
    user_id: number;
    type: TransactionType;
    amount: number;
    ref_type?: string | null;
    ref_id?: string | null;
    meta?: object | null;
    created_at?: Date;
    updated_at?: Date;
}

export default (sequelize: Sequelize) => ({
    BetLedger: sequelize.define<BetLedgerModel>('bet_ledger', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        user_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'bet_users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        type: {
            type: DataTypes.ENUM(
                'earn',
                'spend',
                'escrow_in',
                'escrow_out',
                'refund',
                'payout',
                'void',
            ),
            allowNull: false,
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
            },
        },
        ref_type: {
            type: DataTypes.STRING(50),
            allowNull: true,
        },
        ref_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        meta: {
            type: DataTypes.JSON,
            allowNull: true,
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
                fields: ['user_id', 'created_at'],
                name: 'bet_ledger_user_created_idx',
            },
            {
                fields: ['ref_type', 'ref_id'],
                name: 'bet_ledger_ref_idx',
            },
            {
                fields: ['type'],
                name: 'bet_ledger_type_idx',
            },
            {
                fields: ['created_at'],
                name: 'bet_ledger_created_at_idx',
            },
        ],
    }),
});