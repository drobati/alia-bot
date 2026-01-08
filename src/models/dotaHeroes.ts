import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    DotaHeroes: sequelize.define('DotaHeroes', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        hero_id: {
            type: DataTypes.INTEGER,
            allowNull: false,
            unique: true,
            comment: 'OpenDota hero ID',
        },
        name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Internal hero name (e.g., npc_dota_hero_axe)',
        },
        localized_name: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'Display name (e.g., Axe)',
        },
        primary_attr: {
            type: DataTypes.STRING(10),
            allowNull: false,
            comment: 'Primary attribute: str, agi, int, or all (Universal)',
        },
        attack_type: {
            type: DataTypes.STRING(10),
            allowNull: false,
            comment: 'Attack type: Melee or Ranged',
        },
        roles: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
            comment: 'Array of role strings from OpenDota',
        },
        positions: {
            type: DataTypes.JSON,
            allowNull: false,
            defaultValue: [],
            comment: 'Array of positions: pos1, pos2, pos3, pos4, pos5',
        },
        img: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'CDN path to hero image',
        },
        icon: {
            type: DataTypes.STRING,
            allowNull: true,
            comment: 'CDN path to hero icon',
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
        tableName: 'dota_heroes',
        timestamps: true,
        createdAt: 'created_at',
        updatedAt: 'updated_at',
        indexes: [
            {
                fields: ['primary_attr'],
                name: 'dota_heroes_attr_idx',
            },
            {
                fields: ['attack_type'],
                name: 'dota_heroes_attack_idx',
            },
        ],
    }),
});
