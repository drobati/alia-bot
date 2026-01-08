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
 * @param options Optional filters (date range)
 */
const getWinLoss = async (
    accountId: string,
    options?: { date?: number },
): Promise<WinLoss | null> => {
    const params = new URLSearchParams();
    if (options?.date) {
        params.append('date', options.date.toString());
    }

    const cacheKey = `wl:${accountId}:${params.toString()}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const url = `${OPENDOTA_BASE_URL}/players/${accountId}/wl${params.toString() ? '?' + params.toString() : ''}`;
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

export default {
    getPlayer,
    getWinLoss,
    validateSteamId,
    normalizeSteamId,
    convertSteamId64To32,
    isSteamId64,
};
