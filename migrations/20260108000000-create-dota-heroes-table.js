'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
    async up(queryInterface, Sequelize) {
        // Create dota_heroes table
        await queryInterface.createTable('dota_heroes', {
            id: {
                type: Sequelize.INTEGER,
                primaryKey: true,
                autoIncrement: true,
                allowNull: false,
            },
            hero_id: {
                type: Sequelize.INTEGER,
                allowNull: false,
                unique: true,
                comment: 'OpenDota hero ID',
            },
            name: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Internal hero name (e.g., npc_dota_hero_axe)',
            },
            localized_name: {
                type: Sequelize.STRING,
                allowNull: false,
                comment: 'Display name (e.g., Axe)',
            },
            primary_attr: {
                type: Sequelize.STRING(10),
                allowNull: false,
                comment: 'Primary attribute: str, agi, int, or all (Universal)',
            },
            attack_type: {
                type: Sequelize.STRING(10),
                allowNull: false,
                comment: 'Attack type: Melee or Ranged',
            },
            roles: {
                type: Sequelize.JSON,
                allowNull: false,
                comment: 'Array of role strings from OpenDota',
            },
            positions: {
                type: Sequelize.JSON,
                allowNull: false,
                comment: 'Array of positions: pos1, pos2, pos3, pos4, pos5',
            },
            img: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'CDN path to hero image',
            },
            icon: {
                type: Sequelize.STRING,
                allowNull: true,
                comment: 'CDN path to hero icon',
            },
            created_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
            updated_at: {
                type: Sequelize.DATE,
                allowNull: false,
            },
        });

        // Create index for attribute filtering
        await queryInterface.addIndex('dota_heroes', ['primary_attr'], {
            name: 'dota_heroes_attr_idx',
        });

        // Create index for attack type filtering
        await queryInterface.addIndex('dota_heroes', ['attack_type'], {
            name: 'dota_heroes_attack_idx',
        });
    },

    async down(queryInterface) {
        // Drop indexes first
        await queryInterface.removeIndex('dota_heroes', 'dota_heroes_attr_idx');
        await queryInterface.removeIndex('dota_heroes', 'dota_heroes_attack_idx');

        // Drop table
        await queryInterface.dropTable('dota_heroes');
    },
};
