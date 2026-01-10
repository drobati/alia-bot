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
        // Base stats
        base_health: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Base health (before STR bonus)',
        },
        base_health_regen: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Base health regen per second',
        },
        base_mana: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Base mana (before INT bonus)',
        },
        base_mana_regen: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Base mana regen per second',
        },
        base_armor: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Base armor (before AGI bonus)',
        },
        base_mr: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Base magic resistance percentage',
        },
        // Attributes
        base_str: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Starting strength',
        },
        base_agi: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Starting agility',
        },
        base_int: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Starting intelligence',
        },
        str_gain: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Strength gain per level',
        },
        agi_gain: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Agility gain per level',
        },
        int_gain: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Intelligence gain per level',
        },
        // Attack stats
        base_attack_min: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Minimum base attack damage',
        },
        base_attack_max: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Maximum base attack damage',
        },
        attack_range: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Attack range (150 for melee)',
        },
        projectile_speed: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Projectile speed (for ranged heroes)',
        },
        attack_rate: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Base attack time',
        },
        attack_point: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Attack animation point',
        },
        // Movement/Vision
        move_speed: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Base movement speed',
        },
        turn_rate: {
            type: DataTypes.FLOAT,
            allowNull: true,
            comment: 'Turn rate',
        },
        day_vision: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Day vision range',
        },
        night_vision: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Night vision range',
        },
        // Other
        legs: {
            type: DataTypes.INTEGER,
            allowNull: true,
            comment: 'Number of legs',
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
