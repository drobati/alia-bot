/**
 * Hero position mappings for Dota 2.
 * Maps hero localized names to their typical positions.
 *
 * Positions:
 * - pos1: Safelane Carry (farm priority 1)
 * - pos2: Mid (solo mid, level dependent)
 * - pos3: Offlane (initiator, space creator)
 * - pos4: Soft Support (roaming, playmaking)
 * - pos5: Hard Support (lane support, ward buyer)
 *
 * Many heroes are flex picks and can play multiple positions.
 * This mapping reflects common pub/pro play patterns.
 */

export const HERO_POSITIONS: Record<string, string[]> = {
    // A
    'Abaddon': ['pos3', 'pos4', 'pos5'],
    'Alchemist': ['pos1', 'pos2', 'pos3'],
    'Ancient Apparition': ['pos4', 'pos5'],
    'Anti-Mage': ['pos1'],
    'Arc Warden': ['pos1', 'pos2'],
    'Axe': ['pos3'],

    // B
    'Bane': ['pos4', 'pos5'],
    'Batrider': ['pos3', 'pos4'],
    'Beastmaster': ['pos3'],
    'Bloodseeker': ['pos2', 'pos3'],
    'Bounty Hunter': ['pos4'],
    'Brewmaster': ['pos3', 'pos4'],
    'Bristleback': ['pos3'],
    'Broodmother': ['pos2', 'pos3'],

    // C
    'Centaur Warrunner': ['pos3'],
    'Chaos Knight': ['pos1', 'pos3'],
    'Chen': ['pos4', 'pos5'],
    'Clinkz': ['pos1', 'pos2', 'pos3'],
    'Clockwerk': ['pos3', 'pos4'],
    'Crystal Maiden': ['pos4', 'pos5'],

    // D
    'Dark Seer': ['pos3'],
    'Dark Willow': ['pos4', 'pos5'],
    'Dawnbreaker': ['pos3', 'pos4', 'pos5'],
    'Dazzle': ['pos4', 'pos5'],
    'Death Prophet': ['pos2', 'pos3'],
    'Disruptor': ['pos4', 'pos5'],
    'Doom': ['pos3'],
    'Dragon Knight': ['pos1', 'pos2', 'pos3'],
    'Drow Ranger': ['pos1', 'pos2'],

    // E
    'Earth Spirit': ['pos4'],
    'Earthshaker': ['pos3', 'pos4'],
    'Elder Titan': ['pos3', 'pos4'],
    'Ember Spirit': ['pos1', 'pos2'],
    'Enchantress': ['pos3', 'pos4', 'pos5'],
    'Enigma': ['pos3', 'pos4'],

    // F
    'Faceless Void': ['pos1', 'pos3'],

    // G
    'Grimstroke': ['pos4', 'pos5'],
    'Gyrocopter': ['pos1', 'pos2'],

    // H
    'Hoodwink': ['pos4'],
    'Huskar': ['pos2', 'pos3'],

    // I
    'Invoker': ['pos2'],
    'Io': ['pos4', 'pos5'],

    // J
    'Jakiro': ['pos4', 'pos5'],
    'Juggernaut': ['pos1'],

    // K
    'Keeper of the Light': ['pos4', 'pos5'],
    'Kunkka': ['pos2', 'pos3', 'pos4'],

    // L
    'Legion Commander': ['pos3'],
    'Leshrac': ['pos2', 'pos4', 'pos5'],
    'Lich': ['pos4', 'pos5'],
    'Lifestealer': ['pos1', 'pos3'],
    'Lina': ['pos2', 'pos4', 'pos5'],
    'Lion': ['pos4', 'pos5'],
    'Lone Druid': ['pos1', 'pos3'],
    'Luna': ['pos1', 'pos2'],
    'Lycan': ['pos1', 'pos2', 'pos3'],

    // M
    'Magnus': ['pos2', 'pos3', 'pos4'],
    'Marci': ['pos3', 'pos4'],
    'Mars': ['pos3'],
    'Medusa': ['pos1', 'pos2'],
    'Meepo': ['pos2'],
    'Mirana': ['pos2', 'pos3', 'pos4'],
    'Monkey King': ['pos1', 'pos2', 'pos3'],
    'Morphling': ['pos1', 'pos2'],
    'Muerta': ['pos1', 'pos2'],

    // N
    'Naga Siren': ['pos1', 'pos4'],
    'Nature\'s Prophet': ['pos2', 'pos3', 'pos4'],
    'Necrophos': ['pos2', 'pos3'],
    'Night Stalker': ['pos3', 'pos4'],
    'Nyx Assassin': ['pos4'],

    // O
    'Ogre Magi': ['pos4', 'pos5'],
    'Omniknight': ['pos3', 'pos4', 'pos5'],
    'Oracle': ['pos4', 'pos5'],
    'Outworld Destroyer': ['pos2'],

    // P
    'Pangolier': ['pos2', 'pos3', 'pos4'],
    'Phantom Assassin': ['pos1'],
    'Phantom Lancer': ['pos1'],
    'Phoenix': ['pos3', 'pos4'],
    'Primal Beast': ['pos3'],
    'Puck': ['pos2', 'pos3', 'pos4'],
    'Pudge': ['pos4', 'pos5'],
    'Pugna': ['pos2', 'pos4', 'pos5'],

    // Q
    'Queen of Pain': ['pos2'],

    // R
    'Razor': ['pos1', 'pos2', 'pos3'],
    'Riki': ['pos3', 'pos4'],
    'Ringmaster': ['pos4', 'pos5'],
    'Rubick': ['pos4', 'pos5'],

    // S
    'Sand King': ['pos3', 'pos4'],
    'Shadow Demon': ['pos4', 'pos5'],
    'Shadow Fiend': ['pos1', 'pos2'],
    'Shadow Shaman': ['pos4', 'pos5'],
    'Silencer': ['pos4', 'pos5'],
    'Skywrath Mage': ['pos4', 'pos5'],
    'Slardar': ['pos3', 'pos4'],
    'Slark': ['pos1'],
    'Snapfire': ['pos4', 'pos5'],
    'Sniper': ['pos1', 'pos2'],
    'Spectre': ['pos1'],
    'Spirit Breaker': ['pos3', 'pos4'],
    'Storm Spirit': ['pos2'],
    'Sven': ['pos1', 'pos3'],

    // T
    'Techies': ['pos4', 'pos5'],
    'Templar Assassin': ['pos1', 'pos2'],
    'Terrorblade': ['pos1'],
    'Tidehunter': ['pos3'],
    'Timbersaw': ['pos3'],
    'Tinker': ['pos2'],
    'Tiny': ['pos1', 'pos2', 'pos3'],
    'Treant Protector': ['pos4', 'pos5'],
    'Troll Warlord': ['pos1'],
    'Tusk': ['pos3', 'pos4'],

    // U
    'Underlord': ['pos3', 'pos5'],
    'Undying': ['pos3', 'pos4', 'pos5'],
    'Ursa': ['pos1', 'pos3'],

    // V
    'Vengeful Spirit': ['pos4', 'pos5'],
    'Venomancer': ['pos3', 'pos4', 'pos5'],
    'Viper': ['pos2', 'pos3'],
    'Visage': ['pos2', 'pos3', 'pos4'],
    'Void Spirit': ['pos2', 'pos3'],

    // W
    'Warlock': ['pos4', 'pos5'],
    'Weaver': ['pos1', 'pos3'],
    'Windranger': ['pos2', 'pos3', 'pos4'],
    'Winter Wyvern': ['pos4', 'pos5'],
    'Witch Doctor': ['pos4', 'pos5'],
    'Wraith King': ['pos1', 'pos3'],

    // Z
    'Zeus': ['pos2', 'pos4', 'pos5'],
};

/**
 * Get positions for a hero by name.
 * Returns empty array if hero not found.
 */
export function getHeroPositions(heroName: string): string[] {
    return HERO_POSITIONS[heroName] || [];
}

/**
 * Get all hero names that can play a specific position.
 */
export function getHeroesForPosition(position: string): string[] {
    return Object.entries(HERO_POSITIONS)
        .filter(([, positions]) => positions.includes(position))
        .map(([heroName]) => heroName);
}
