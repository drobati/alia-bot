import axios from 'axios';

const OPENDOTA_BASE_URL = 'https://api.opendota.com/api';

// Simple in-memory cache with 5 minute TTL
const cache: Map<string, { data: any; expires: number }> = new Map();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

const getCached = (key: string): any | null => {
    const cached = cache.get(key);
    if (cached && cached.expires > Date.now()) {
        return cached.data;
    }
    cache.delete(key);
    return null;
};

const setCache = (key: string, data: any): void => {
    cache.set(key, { data, expires: Date.now() + CACHE_TTL });
};

export interface PlayerProfile {
    account_id: number;
    personaname: string;
    name: string | null;
    avatar: string;
    avatarfull: string;
    steamid: string;
    profileurl: string;
}

export interface PlayerData {
    profile?: PlayerProfile;
    rank_tier?: number;
    leaderboard_rank?: number;
    mmr_estimate?: {
        estimate: number;
    };
}

export interface WinLoss {
    win: number;
    lose: number;
}

export interface HeroStats {
    hero_id: number;
    last_played: number;
    games: number;
    win: number;
    with_games: number;
    with_win: number;
    against_games: number;
    against_win: number;
}

export interface RecentMatch {
    match_id: number;
    player_slot: number;
    radiant_win: boolean;
    hero_id: number;
    duration: number;
    game_mode: number;
    lobby_type: number;
    start_time: number;
    kills: number;
    deaths: number;
    assists: number;
    average_rank?: number;
    party_size?: number;
}

export interface PlayerTotals {
    field: string;
    n: number;
    sum: number;
}

export interface Peer {
    account_id: number;
    last_played: number;
    win: number;
    games: number;
    with_win: number;
    with_games: number;
    against_win: number;
    against_games: number;
    with_gpm_sum: number;
    with_xpm_sum: number;
    personaname?: string;
    avatar?: string;
}

export interface MatchPlayer {
    account_id: number;
    player_slot: number;
    hero_id: number;
    kills: number;
    deaths: number;
    assists: number;
    last_hits: number;
    denies: number;
    gold_per_min: number;
    xp_per_min: number;
    level: number;
    net_worth: number;
    personaname?: string;
    isRadiant: boolean;
}

export interface MatchDetails {
    match_id: number;
    duration: number;
    start_time: number;
    radiant_win: boolean;
    radiant_score: number;
    dire_score: number;
    game_mode: number;
    lobby_type: number;
    players: MatchPlayer[];
}

export interface HeroConstant {
    id: number;
    name: string;
    localized_name: string;
    primary_attr: string;
    attack_type: string;
    roles: string[];
    img: string;
    icon: string;
    // Base stats
    base_health: number;
    base_health_regen: number;
    base_mana: number;
    base_mana_regen: number;
    base_armor: number;
    base_mr: number;
    // Attributes
    base_str: number;
    base_agi: number;
    base_int: number;
    str_gain: number;
    agi_gain: number;
    int_gain: number;
    // Attack
    base_attack_min: number;
    base_attack_max: number;
    attack_range: number;
    projectile_speed: number;
    attack_rate: number;
    attack_point: number;
    // Movement/Vision
    move_speed: number;
    turn_rate: number | null;
    day_vision: number;
    night_vision: number;
    // Other
    legs: number;
}

/**
 * OpenDota "significant" parameter controls Turbo inclusion:
 * - significant=0: Include ALL games (including Turbo)
 * - significant=1: Exclude Turbo (only "significant" ranked/unranked games)
 *
 * By default, OpenDota API excludes Turbo games (significant=1 is implicit)
 */
export const MODE_PRESETS = {
    all: { significant: 0 },      // All games including Turbo
    ranked: { significant: 1 },   // Excludes Turbo (significant games only)
} as const;

export type ModePreset = keyof typeof MODE_PRESETS;

/**
 * Get player profile and basic stats
 * @param accountId Steam 32-bit account ID
 */
const getPlayer = async (accountId: string): Promise<PlayerData | null> => {
    const cacheKey = `player:${accountId}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const response = await axios.get(`${OPENDOTA_BASE_URL}/players/${accountId}`, {
            timeout: 10000,
        });
        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
};

/**
 * Get player win/loss record
 * @param accountId Steam 32-bit account ID
 * @param options Optional filters (date range, significant flag for Turbo inclusion)
 */
const getWinLoss = async (
    accountId: string,
    options?: { date?: number; significant?: number },
): Promise<WinLoss | null> => {
    const params = new URLSearchParams();
    if (options?.date) {
        params.append('date', options.date.toString());
    }
    if (options?.significant !== undefined) {
        // significant=0 includes Turbo, significant=1 excludes Turbo
        params.append('significant', options.significant.toString());
    }

    const cacheKey = `wl:${accountId}:${params.toString()}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const queryString = params.toString();
        const url = `${OPENDOTA_BASE_URL}/players/${accountId}/wl${queryString ? '?' + queryString : ''}`;
        const response = await axios.get(url, {
            timeout: 10000,
        });
        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
};

/**
 * Validate a Steam ID by checking if player exists
 * @param accountId Steam 32-bit account ID
 */
const validateSteamId = async (accountId: string): Promise<boolean> => {
    const player = await getPlayer(accountId);
    return player !== null && player.profile !== undefined;
};

/**
 * Convert Steam 64-bit ID to 32-bit account ID
 * @param steamId64 Steam 64-bit ID
 */
const convertSteamId64To32 = (steamId64: string): string => {
    const id64 = BigInt(steamId64);
    const id32 = id64 - BigInt('76561197960265728');
    return id32.toString();
};

/**
 * Check if string looks like a Steam 64-bit ID
 */
const isSteamId64 = (steamId: string): boolean => steamId.length === 17 && steamId.startsWith('7656');

/**
 * Parse and normalize Steam ID to 32-bit format
 */
const normalizeSteamId = (steamId: string): string => {
    // Remove any whitespace
    steamId = steamId.trim();

    // If it looks like a 64-bit ID, convert it
    if (isSteamId64(steamId)) {
        return convertSteamId64To32(steamId);
    }

    // Otherwise assume it's already 32-bit
    return steamId;
};

/**
 * Get player hero stats
 * @param accountId Steam 32-bit account ID
 */
const getHeroes = async (
    accountId: string,
    options?: { significant?: number },
): Promise<HeroStats[]> => {
    const params = new URLSearchParams();
    if (options?.significant !== undefined) {
        params.append('significant', options.significant.toString());
    }

    const cacheKey = `heroes:${accountId}:${params.toString()}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const queryString = params.toString();
        const url = `${OPENDOTA_BASE_URL}/players/${accountId}/heroes${queryString ? '?' + queryString : ''}`;
        const response = await axios.get(url, { timeout: 10000 });
        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return [];
        }
        throw error;
    }
};

/**
 * Get player recent matches
 * @param accountId Steam 32-bit account ID
 * @param limit Number of matches to return (default 20)
 */
const getRecentMatches = async (
    accountId: string,
    limit: number = 20,
): Promise<RecentMatch[]> => {
    const cacheKey = `recent:${accountId}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const url = `${OPENDOTA_BASE_URL}/players/${accountId}/recentMatches`;
        const response = await axios.get(url, { timeout: 10000 });
        const data = response.data.slice(0, limit);
        setCache(cacheKey, data);
        return data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return [];
        }
        throw error;
    }
};

/**
 * Get player totals/aggregates
 * @param accountId Steam 32-bit account ID
 */
const getTotals = async (
    accountId: string,
    options?: { significant?: number },
): Promise<PlayerTotals[]> => {
    const params = new URLSearchParams();
    if (options?.significant !== undefined) {
        params.append('significant', options.significant.toString());
    }

    const cacheKey = `totals:${accountId}:${params.toString()}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const queryString = params.toString();
        const url = `${OPENDOTA_BASE_URL}/players/${accountId}/totals${queryString ? '?' + queryString : ''}`;
        const response = await axios.get(url, { timeout: 10000 });
        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return [];
        }
        throw error;
    }
};

/**
 * Get player peers (people they play with)
 * @param accountId Steam 32-bit account ID
 */
const getPeers = async (
    accountId: string,
    options?: { significant?: number },
): Promise<Peer[]> => {
    const params = new URLSearchParams();
    if (options?.significant !== undefined) {
        params.append('significant', options.significant.toString());
    }

    const cacheKey = `peers:${accountId}:${params.toString()}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const queryString = params.toString();
        const url = `${OPENDOTA_BASE_URL}/players/${accountId}/peers${queryString ? '?' + queryString : ''}`;
        const response = await axios.get(url, { timeout: 10000 });
        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return [];
        }
        throw error;
    }
};

/**
 * Get match details
 * @param matchId Match ID
 */
const getMatch = async (matchId: string): Promise<MatchDetails | null> => {
    const cacheKey = `match:${matchId}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const url = `${OPENDOTA_BASE_URL}/matches/${matchId}`;
        const response = await axios.get(url, { timeout: 15000 });
        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
};

// Hero constants cache (longer TTL since heroes rarely change)
let heroConstants: Record<number, HeroConstant> | null = null;
let heroConstantsExpires = 0;
const HERO_CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours

/**
 * Get hero constants (names, attributes, etc.)
 */
const getHeroConstants = async (): Promise<Record<number, HeroConstant>> => {
    if (heroConstants && heroConstantsExpires > Date.now()) {
        return heroConstants;
    }

    try {
        const url = `${OPENDOTA_BASE_URL}/constants/heroes`;
        const response = await axios.get(url, { timeout: 10000 });
        heroConstants = response.data;
        heroConstantsExpires = Date.now() + HERO_CACHE_TTL;
        return response.data;
    } catch (error: any) {
        // Return empty object if failed, don't crash
        return {};
    }
};

/**
 * Get hero name by ID
 */
const getHeroName = async (heroId: number): Promise<string> => {
    const heroes = await getHeroConstants();
    return heroes[heroId]?.localized_name || `Hero ${heroId}`;
};

export default {
    getPlayer,
    getWinLoss,
    getHeroes,
    getRecentMatches,
    getTotals,
    getPeers,
    getMatch,
    getHeroConstants,
    getHeroName,
    validateSteamId,
    normalizeSteamId,
    convertSteamId64To32,
    isSteamId64,
    MODE_PRESETS,
};
