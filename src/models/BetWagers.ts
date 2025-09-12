import { DataTypes, Model, Sequelize, InferAttributes, InferCreationAttributes, UUIDV4 } from "sequelize";

type BetStatus = 'open' | 'closed' | 'settled' | 'void';
type BetOutcome = 'for' | 'against' | 'void';

interface BetWagersModel extends Model<InferAttributes<BetWagersModel>, InferCreationAttributes<BetWagersModel>> {
    id: string;
    opener_id: number;
    statement: string;
    odds_for: number;
    odds_against: number;
    status: BetStatus;
    total_for: number;
    total_against: number;
    opens_at: Date;
    closes_at: Date;
    settled_at?: Date | null;
    outcome?: BetOutcome | null;
    created_at?: Date;
    updated_at?: Date;
}

export default (sequelize: Sequelize) => ({
    BetWagers: sequelize.define<BetWagersModel>('bet_wagers', {
        id: {
            type: DataTypes.UUID,
            primaryKey: true,
            defaultValue: UUIDV4,
            allowNull: false,
        },
        opener_id: {
            type: DataTypes.BIGINT,
            allowNull: false,
            references: {
                model: 'bet_users',
                key: 'id',
            },
            onUpdate: 'CASCADE',
            onDelete: 'CASCADE',
        },
        statement: {
            type: DataTypes.TEXT,
            allowNull: false,
            validate: {
                len: [1, 200],
                notEmpty: true,
            },
        },
        odds_for: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: {
                min: 1,
                max: 10,
            },
        },
        odds_against: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 1,
            validate: {
                min: 1,
                max: 10,
            },
        },
        status: {
            type: DataTypes.ENUM('open', 'closed', 'settled', 'void'),
            allowNull: false,
            defaultValue: 'open',
        },
        total_for: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
            },
        },
        total_against: {
            type: DataTypes.INTEGER,
            allowNull: false,
            defaultValue: 0,
            validate: {
                min: 0,
            },
        },
        opens_at: {
            type: DataTypes.DATE,
            allowNull: false,
            defaultValue: DataTypes.NOW,
        },
        closes_at: {
            type: DataTypes.DATE,
            allowNull: false,
        },
        settled_at: {
            type: DataTypes.DATE,
            allowNull: true,
        },
        outcome: {
            type: DataTypes.ENUM('for', 'against', 'void'),
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
                fields: ['status', 'closes_at'],
                name: 'bet_wagers_status_closes_idx',
            },
            {
                fields: ['opener_id', 'created_at'],
                name: 'bet_wagers_opener_created_idx',
            },
            {
                fields: ['created_at'],
                name: 'bet_wagers_created_at_idx',
            },
            {
                fields: ['closes_at'],
                name: 'bet_wagers_closes_at_idx',
            },
        ],
        validate: {
            settlementLogic() {
                if (this.status === 'settled' && (!this.outcome || !this.settled_at)) {
                    throw new Error('Settled bets must have outcome and settled_at timestamp');
                }
                if (this.status !== 'settled' && this.outcome) {
                    throw new Error('Only settled bets can have an outcome');
                }
            },
        },
    }),
});