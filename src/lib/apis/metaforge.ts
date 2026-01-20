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
    flavor_text: string | null;
    icon: string;
    loot_area: string;
    created_at: string;
    updated_at: string;
}

export interface ArcEvent {
    name: string;
    map: string;
    icon: string;
    startTime: number; // Unix timestamp in milliseconds
    endTime: number;   // Unix timestamp in milliseconds
}

export interface ArcEventsResponse {
    data: ArcEvent[];
    cachedAt: number;
}

// Available event types for autocomplete and validation
export const ARC_EVENT_TYPES = [
    'Harvester',
    'Husk Graveyard',
    'Night Raid',
    'Electromagnetic Storm',
    'Prospecting Probes',
    'Matriarch',
    'Locked Gate',
    'Launch Tower Loot',
    'Hidden Bunker',
    'Lush Blooms',
    'Uncovered Caches',
] as const;

export type ArcEventType = typeof ARC_EVENT_TYPES[number];

// Available maps for autocomplete and validation
export const ARC_MAPS = [
    'Spaceport',
    'Blue Gate',
    'Buried City',
    'Dam',
    'Stella Montis',
] as const;

export type ArcMapName = typeof ARC_MAPS[number];

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
            (item: ArcItem) => item.name.toLowerCase() === name.toLowerCase(),
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

    const response = await axios.get<ArcItemsResponse>(`${METAFORGE_BASE_URL}/items`, {
        params: { page, limit },
        timeout: 10000,
    });
    setCache(cacheKey, response.data);
    return response.data;
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

/**
 * Get all upcoming events from MetaForge API
 */
const getEvents = async (): Promise<ArcEvent[]> => {
    const cacheKey = 'events:all';
    const cached = getCached(cacheKey);
    if (cached) {return cached;}

    try {
        const response = await axios.get<ArcEventsResponse>(`${METAFORGE_BASE_URL}/events`, {
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
 * Get events starting within the specified number of minutes
 * @param minutes Number of minutes to look ahead
 * @param filterMap Optional map filter
 * @param filterEvent Optional event type filter
 */
const getUpcomingEvents = async (
    minutes: number,
    filterMap?: string,
    filterEvent?: string,
): Promise<ArcEvent[]> => {
    const events = await getEvents();
    const now = Date.now();
    const cutoff = now + minutes * 60 * 1000;

    return events.filter(event => {
        // Event starts within the time window
        const startsInWindow = event.startTime > now && event.startTime <= cutoff;
        if (!startsInWindow) {return false;}

        // Apply map filter
        if (filterMap && event.map.toLowerCase() !== filterMap.toLowerCase()) {
            return false;
        }

        // Apply event type filter
        if (filterEvent && event.name.toLowerCase() !== filterEvent.toLowerCase()) {
            return false;
        }

        return true;
    });
};

/**
 * Get events that are currently active
 * @param filterMap Optional map filter
 * @param filterEvent Optional event type filter
 */
const getActiveEvents = async (
    filterMap?: string,
    filterEvent?: string,
): Promise<ArcEvent[]> => {
    const events = await getEvents();
    const now = Date.now();

    return events.filter(event => {
        // Event is currently active
        const isActive = event.startTime <= now && event.endTime > now;
        if (!isActive) {return false;}

        // Apply map filter
        if (filterMap && event.map.toLowerCase() !== filterMap.toLowerCase()) {
            return false;
        }

        // Apply event type filter
        if (filterEvent && event.name.toLowerCase() !== filterEvent.toLowerCase()) {
            return false;
        }

        return true;
    });
};

/**
 * Get events grouped by map for the next N hours
 * @param hours Number of hours to look ahead
 */
const getEventsGroupedByMap = async (hours: number = 2): Promise<Map<string, ArcEvent[]>> => {
    const events = await getEvents();
    const now = Date.now();
    const cutoff = now + hours * 60 * 60 * 1000;

    const grouped = new Map<string, ArcEvent[]>();

    for (const event of events) {
        // Include events that start or are active within the window
        if (event.startTime <= cutoff && event.endTime > now) {
            const mapEvents = grouped.get(event.map) || [];
            mapEvents.push(event);
            grouped.set(event.map, mapEvents);
        }
    }

    // Sort events by start time within each map
    for (const [map, mapEvents] of grouped) {
        grouped.set(map, mapEvents.sort((a, b) => a.startTime - b.startTime));
    }

    return grouped;
};

export default {
    searchItems,
    getItemByName,
    getAllItems,
    formatItemStats,
    getEvents,
    getUpcomingEvents,
    getActiveEvents,
    getEventsGroupedByMap,
    RARITY_COLORS,
    ARC_EVENT_TYPES,
    ARC_MAPS,
};
