import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes } from "sequelize";

type BetSide = 'for' | 'against';

interface BetParticipantsModel extends Model<
    InferAttributes<BetParticipantsModel>,
    InferCreationAttributes<BetParticipantsModel>
> {
    id: number;
    bet_id: string;
    user_id: number;
    side: BetSide;
    amount: number;
    joined_at: Date;
    created_at?: Date;
    updated_at?: Date;
}

export default (sequelize: Sequelize) => ({
    BetParticipants: sequelize.define<BetParticipantsModel>('bet_participants', {
        id: {
            type: DataTypes.BIGINT,
            primaryKey: true,
            autoIncrement: true,
            allowNull: false,
        },
        bet_id: {
            type: DataTypes.UUID,
            allowNull: false,
            references: {
                model: 'bet_wagers',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
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
        side: {
            type: DataTypes.ENUM('for', 'against'),
            allowNull: false,
        },
        amount: {
            type: DataTypes.INTEGER,
            allowNull: false,
            validate: {
                min: 1,
            },
        },
        joined_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
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
                fields: ['bet_id', 'user_id', 'side'],
                name: 'bet_participants_unique_participation',
            },
            {
                fields: ['bet_id', 'side'],
                name: 'bet_participants_bet_side_idx',
            },
            {
                fields: ['user_id', 'joined_at'],
                name: 'bet_participants_user_joined_idx',
            },
        ],
    }),
});