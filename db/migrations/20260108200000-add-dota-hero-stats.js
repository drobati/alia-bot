'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Add base stats columns
        await queryInterface.addColumn('dota_heroes', 'base_health', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Base health (before STR bonus)',
        });
        await queryInterface.addColumn('dota_heroes', 'base_health_regen', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Base health regen per second',
        });
        await queryInterface.addColumn('dota_heroes', 'base_mana', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Base mana (before INT bonus)',
        });
        await queryInterface.addColumn('dota_heroes', 'base_mana_regen', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Base mana regen per second',
        });
        await queryInterface.addColumn('dota_heroes', 'base_armor', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Base armor (before AGI bonus)',
        });
        await queryInterface.addColumn('dota_heroes', 'base_mr', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Base magic resistance percentage',
        });

        // Add attribute columns
        await queryInterface.addColumn('dota_heroes', 'base_str', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Starting strength',
        });
        await queryInterface.addColumn('dota_heroes', 'base_agi', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Starting agility',
        });
        await queryInterface.addColumn('dota_heroes', 'base_int', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Starting intelligence',
        });
        await queryInterface.addColumn('dota_heroes', 'str_gain', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Strength gain per level',
        });
        await queryInterface.addColumn('dota_heroes', 'agi_gain', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Agility gain per level',
        });
        await queryInterface.addColumn('dota_heroes', 'int_gain', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Intelligence gain per level',
        });

        // Add attack columns
        await queryInterface.addColumn('dota_heroes', 'base_attack_min', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Minimum base attack damage',
        });
        await queryInterface.addColumn('dota_heroes', 'base_attack_max', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Maximum base attack damage',
        });
        await queryInterface.addColumn('dota_heroes', 'attack_range', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Attack range (150 for melee)',
        });
        await queryInterface.addColumn('dota_heroes', 'projectile_speed', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Projectile speed (for ranged heroes)',
        });
        await queryInterface.addColumn('dota_heroes', 'attack_rate', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Base attack time',
        });
        await queryInterface.addColumn('dota_heroes', 'attack_point', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Attack animation point',
        });

        // Add movement/vision columns
        await queryInterface.addColumn('dota_heroes', 'move_speed', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Base movement speed',
        });
        await queryInterface.addColumn('dota_heroes', 'turn_rate', {
            type: Sequelize.FLOAT,
            allowNull: true,
            comment: 'Turn rate (can be null)',
        });
        await queryInterface.addColumn('dota_heroes', 'day_vision', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Day vision range',
        });
        await queryInterface.addColumn('dota_heroes', 'night_vision', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Night vision range',
        });

        // Add legs column
        await queryInterface.addColumn('dota_heroes', 'legs', {
            type: Sequelize.INTEGER,
            allowNull: true,
            comment: 'Number of legs',
        });
    },

    async down(queryInterface) {
        // Remove all added columns in reverse order
        await queryInterface.removeColumn('dota_heroes', 'legs');
        await queryInterface.removeColumn('dota_heroes', 'night_vision');
        await queryInterface.removeColumn('dota_heroes', 'day_vision');
        await queryInterface.removeColumn('dota_heroes', 'turn_rate');
        await queryInterface.removeColumn('dota_heroes', 'move_speed');
        await queryInterface.removeColumn('dota_heroes', 'attack_point');
        await queryInterface.removeColumn('dota_heroes', 'attack_rate');
        await queryInterface.removeColumn('dota_heroes', 'projectile_speed');
        await queryInterface.removeColumn('dota_heroes', 'attack_range');
        await queryInterface.removeColumn('dota_heroes', 'base_attack_max');
        await queryInterface.removeColumn('dota_heroes', 'base_attack_min');
        await queryInterface.removeColumn('dota_heroes', 'int_gain');
        await queryInterface.removeColumn('dota_heroes', 'agi_gain');
        await queryInterface.removeColumn('dota_heroes', 'str_gain');
        await queryInterface.removeColumn('dota_heroes', 'base_int');
        await queryInterface.removeColumn('dota_heroes', 'base_agi');
        await queryInterface.removeColumn('dota_heroes', 'base_str');
        await queryInterface.removeColumn('dota_heroes', 'base_mr');
        await queryInterface.removeColumn('dota_heroes', 'base_armor');
        await queryInterface.removeColumn('dota_heroes', 'base_mana_regen');
        await queryInterface.removeColumn('dota_heroes', 'base_mana');
        await queryInterface.removeColumn('dota_heroes', 'base_health_regen');
        await queryInterface.removeColumn('dota_heroes', 'base_health');
    },
};
