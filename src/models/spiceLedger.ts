import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    SpiceLedger: sequelize.define('SpiceLedger', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Discord guild ID',
        },
        discord_id: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Discord user ID',
        },
        type: {
            type: DataTypes.ENUM(
                'harvest',
                'give_sent',
                'give_received',
                'tribute_paid',
                'tribute_received',
            ),
            allowNull: false,
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
        },
        target_discord_id: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'For give transactions, the other party Discord ID',
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
        tableName: 'spice_ledger',
        timestamps: false,
        indexes: [
            {
                fields: ['guild_id', 'discord_id', 'created_at'],
                name: 'spice_ledger_user_created_idx',
            },
            {
                fields: ['guild_id', 'type'],
                name: 'spice_ledger_guild_type_idx',
            },
        ],
    }),
});
