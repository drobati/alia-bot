import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    SparksBalance: sequelize.define('SparksBalance', {
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
        current_balance: {
            type: DataTypes.INTEGER,
            defaultValue: 100,
            allowNull: false,
        },
        escrow_balance: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        lifetime_earned: {
            type: DataTypes.INTEGER,
            defaultValue: 100,
            allowNull: false,
        },
        lifetime_spent: {
            type: DataTypes.INTEGER,
            defaultValue: 0,
            allowNull: false,
        },
        created_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
        updated_at: {
            type: DataTypes.DATE,
            defaultValue: DataTypes.NOW,
        },
    }, {
        tableName: 'sparks_balances',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                unique: true,
                fields: ['user_id'],
                name: 'sparks_balances_user_unique',
            },
        ],
    }),
});
