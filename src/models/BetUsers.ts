import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

interface BetUsersModel extends Model<InferAttributes<BetUsersModel>, InferCreationAttributes<BetUsersModel>> {
    id: number;
    discord_id: string;
    handle: string | null;
    hide_last_seen: boolean;
    created_at?: Date;
    updated_at?: Date;
}

export default (sequelize: Sequelize) => ({
    BetUsers: sequelize.define<BetUsersModel>('bet_users', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        discord_id: {
            type: DataTypes.STRING(255),
            allowNull: false,
            unique: true,
            validate: {
                len: [17, 19], // Discord snowflake ID length
                isNumeric: true,
            },
        },
        handle: {
            type: DataTypes.STRING(255),
            allowNull: true,
        },
        hide_last_seen: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            defaultValue: false,
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
                unique: true,
                fields: ['discord_id'],
                name: 'bet_users_discord_id_unique',
            },
            {
                fields: ['handle'],
                name: 'bet_users_handle_idx',
            },
            {
                fields: ['created_at'],
                name: 'bet_users_created_at_idx',
            },
        ],
    }),
});