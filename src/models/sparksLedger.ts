import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    SparksLedger: sequelize.define('SparksLedger', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        user_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            references: {
                model: 'sparks_users',
                key: 'id',
            },
        },
        type: {
            type: DataTypes.ENUM('earn', 'spend', 'escrow_in', 'escrow_out', 'refund', 'payout', 'void', 'daily_bonus'),
            allowNull: false,
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        ref_type: {
            type: DataTypes.STRING(50),
            allowNull: true,
            comment: 'Reference type: message, bet, daily_bonus, etc.',
        },
        ref_id: {
            type: DataTypes.STRING(255),
            allowNull: true,
            comment: 'Reference ID: message_id, bet_id, etc.',
        },
        description: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'sparks_ledger',
        timestamps: false,
        indexes: [
            {
                fields: ['user_id', 'created_at'],
                name: 'sparks_ledger_user_created_idx',
            },
            {
                fields: ['ref_type', 'ref_id'],
                name: 'sparks_ledger_ref_idx',
            },
        ],
    }),
});
