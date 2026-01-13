import axios from 'axios';

const METAFORGE_BASE_URL = 'https://metaforge.app/api/arc-raiders';

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

// API Response Interfaces
export interface ArcItem {
    id: string;
    name: string;
    description: string;
    item_type: string;
    rarity: string;
    value: number;
    weight: number;
    loadout_slots: string[];
    stat_block: Record<string, any>;
    workbench: string | null;
    icon: string;
    loot_area: string;
    created_at: string;
    updated_at: string;
}

export interface ArcItemsResponse {
    data: ArcItem[];
    maxValue: number;
    pagination: {
        page: number;
        limit: number;
        total: number;
        totalPages: number;
        hasNextPage: boolean;
        hasPrevPage: boolean;
    };
}

// Rarity color mapping for embeds
export const RARITY_COLORS: Record<string, number> = {
    Common: 0x9d9d9d,
    Uncommon: 0x1eff00,
    Rare: 0x0070dd,
    Epic: 0xa335ee,
    Legendary: 0xff8000,
};

/**
 * Search items by name
 * @param query Search query string
 * @param limit Maximum results to return (default 25 for autocomplete)
 */
const searchItems = async (query: string, limit: number = 25): Promise<ArcItem[]> => {
    const cacheKey = `search:${query.toLowerCase()}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const response = await axios.get<ArcItemsResponse>(`${METAFORGE_BASE_URL}/items`, {
            params: {
                search: query,
                limit,
            },
            timeout: 10000,
        });
        setCache(cacheKey, response.data.data);
        return response.data.data;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return [];
        }
        throw error;
    }
};

/**
 * Get item by exact name
 * @param name Item name to search for
 */
const getItemByName = async (name: string): Promise<ArcItem | null> => {
    const cacheKey = `item:${name.toLowerCase()}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const response = await axios.get<ArcItemsResponse>(`${METAFORGE_BASE_URL}/items`, {
            params: {
                search: name,
                limit: 10,
            },
            timeout: 10000,
        });

        // Find exact match (case-insensitive)
        const exactMatch = response.data.data.find(
            item => item.name.toLowerCase() === name.toLowerCase(),
        );

        if (exactMatch) {
            setCache(cacheKey, exactMatch);
            return exactMatch;
        }

        // Return first result if no exact match
        if (response.data.data.length > 0) {
            setCache(cacheKey, response.data.data[0]);
            return response.data.data[0];
        }

        return null;
    } catch (error: any) {
        if (error.response?.status === 404) {
            return null;
        }
        throw error;
    }
};

/**
 * Get all items with pagination
 * @param page Page number (1-indexed)
 * @param limit Items per page
 */
const getAllItems = async (page: number = 1, limit: number = 50): Promise<ArcItemsResponse> => {
    const cacheKey = `all:${page}:${limit}`;
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const response = await axios.get<ArcItemsResponse>(`${METAFORGE_BASE_URL}/items`, {
            params: { page, limit },
            timeout: 10000,
        });
        setCache(cacheKey, response.data);
        return response.data;
    } catch (error: any) {
        throw error;
    }
};

/**
 * Format item stats for display
 */
const formatItemStats = (item: ArcItem): string[] => {
    const stats: string[] = [];

    if (item.stat_block) {
        const relevantStats = ['damage', 'range', 'healing', 'armor', 'stamina'];
        for (const stat of relevantStats) {
            if (item.stat_block[stat] && item.stat_block[stat] !== 0) {
                const formattedStat = stat.charAt(0).toUpperCase() + stat.slice(1);
                stats.push(`${formattedStat}: ${item.stat_block[stat]}`);
            }
        }
    }

    return stats;
};

export default {
    searchItems,
    getItemByName,
    getAllItems,
    formatItemStats,
    RARITY_COLORS,
};
