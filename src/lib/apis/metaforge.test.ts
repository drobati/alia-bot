import axios from 'axios';
import metaforge, { RARITY_COLORS, ArcItem } from './metaforge';

jest.mock('axios');
const mockedAxios = axios as jest.Mocked<typeof axios>;

describe('MetaForge API', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    describe('RARITY_COLORS', () => {
        it('should have correct color for Common', () => {
            expect(RARITY_COLORS.Common).toBe(0x9d9d9d);
        });

        it('should have correct color for Uncommon', () => {
            expect(RARITY_COLORS.Uncommon).toBe(0x1eff00);
        });

        it('should have correct color for Rare', () => {
            expect(RARITY_COLORS.Rare).toBe(0x0070dd);
        });

        it('should have correct color for Epic', () => {
            expect(RARITY_COLORS.Epic).toBe(0xa335ee);
        });

        it('should have correct color for Legendary', () => {
            expect(RARITY_COLORS.Legendary).toBe(0xff8000);
        });
    });

    describe('searchItems', () => {
        it('should search items and return results', async () => {
            const mockItems: ArcItem[] = [
                {
                    id: '1',
                    name: 'Test Item',
                    description: 'A test item',
                    item_type: 'Weapon',
                    rarity: 'Rare',
                    value: 100,
                    weight: 1,
                    loadout_slots: [],
                    stat_block: {},
                    workbench: null,
                    flavor_text: null,
                    icon: 'http://example.com/icon.png',
                    loot_area: 'Test Zone',
                    created_at: '2024-01-01',
                    updated_at: '2024-01-01',
                },
            ];

            mockedAxios.get.mockResolvedValue({
                data: { data: mockItems },
            });

            const result = await metaforge.searchItems('test');

            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://metaforge.app/api/arc-raiders/items',
                {
                    params: { search: 'test', limit: 25 },
                    timeout: 10000,
                },
            );
            expect(result).toEqual(mockItems);
        });

        it('should return empty array on 404', async () => {
            mockedAxios.get.mockRejectedValue({
                response: { status: 404 },
            });

            const result = await metaforge.searchItems('nonexistent');

            expect(result).toEqual([]);
        });

        it('should throw on other errors', async () => {
            mockedAxios.get.mockRejectedValue(new Error('Network error'));

            await expect(metaforge.searchItems('uniqueErrorQuery')).rejects.toThrow('Network error');
        });

        it('should use cache for repeated queries', async () => {
            const mockItems: ArcItem[] = [
                {
                    id: '1',
                    name: 'Cached Item',
                    description: '',
                    item_type: '',
                    rarity: '',
                    value: 0,
                    weight: 0,
                    loadout_slots: [],
                    stat_block: {},
                    workbench: null,
                    flavor_text: null,
                    icon: '',
                    loot_area: '',
                    created_at: '',
                    updated_at: '',
                },
            ];

            mockedAxios.get.mockResolvedValue({
                data: { data: mockItems },
            });

            // First call
            await metaforge.searchItems('cached');
            // Second call - should use cache
            const result = await metaforge.searchItems('cached');

            expect(mockedAxios.get).toHaveBeenCalledTimes(1);
            expect(result).toEqual(mockItems);
        });
    });

    describe('getItemByName', () => {
        it('should return exact match when found', async () => {
            const mockItems: ArcItem[] = [
                {
                    id: '1',
                    name: 'Exact Match',
                    description: '',
                    item_type: '',
                    rarity: '',
                    value: 0,
                    weight: 0,
                    loadout_slots: [],
                    stat_block: {},
                    workbench: null,
                    flavor_text: null,
                    icon: '',
                    loot_area: '',
                    created_at: '',
                    updated_at: '',
                },
                {
                    id: '2',
                    name: 'Exact Match Plus',
                    description: '',
                    item_type: '',
                    rarity: '',
                    value: 0,
                    weight: 0,
                    loadout_slots: [],
                    stat_block: {},
                    workbench: null,
                    flavor_text: null,
                    icon: '',
                    loot_area: '',
                    created_at: '',
                    updated_at: '',
                },
            ];

            mockedAxios.get.mockResolvedValue({
                data: { data: mockItems },
            });

            const result = await metaforge.getItemByName('Exact Match');

            expect(result).toEqual(mockItems[0]);
        });

        it('should return first result when no exact match', async () => {
            const mockItems: ArcItem[] = [
                {
                    id: '1',
                    name: 'Similar Item',
                    description: '',
                    item_type: '',
                    rarity: '',
                    value: 0,
                    weight: 0,
                    loadout_slots: [],
                    stat_block: {},
                    workbench: null,
                    flavor_text: null,
                    icon: '',
                    loot_area: '',
                    created_at: '',
                    updated_at: '',
                },
            ];

            mockedAxios.get.mockResolvedValue({
                data: { data: mockItems },
            });

            const result = await metaforge.getItemByName('Different');

            expect(result).toEqual(mockItems[0]);
        });

        it('should return null when no results', async () => {
            mockedAxios.get.mockResolvedValue({
                data: { data: [] },
            });

            const result = await metaforge.getItemByName('Nonexistent');

            expect(result).toBeNull();
        });

        it('should return null on 404', async () => {
            mockedAxios.get.mockRejectedValue({
                response: { status: 404 },
            });

            const result = await metaforge.getItemByName('notfound');

            expect(result).toBeNull();
        });
    });

    describe('getAllItems', () => {
        it('should fetch paginated items', async () => {
            const mockResponse = {
                data: [],
                maxValue: 100,
                pagination: {
                    page: 1,
                    limit: 50,
                    total: 100,
                    totalPages: 2,
                    hasNextPage: true,
                    hasPrevPage: false,
                },
            };

            mockedAxios.get.mockResolvedValue({
                data: mockResponse,
            });

            const result = await metaforge.getAllItems(1, 50);

            expect(mockedAxios.get).toHaveBeenCalledWith(
                'https://metaforge.app/api/arc-raiders/items',
                {
                    params: { page: 1, limit: 50 },
                    timeout: 10000,
                },
            );
            expect(result).toEqual(mockResponse);
        });
    });

    describe('formatItemStats', () => {
        it('should format stats from stat_block', () => {
            const item: ArcItem = {
                id: '1',
                name: 'Test',
                description: '',
                item_type: '',
                rarity: '',
                value: 0,
                weight: 0,
                loadout_slots: [],
                stat_block: {
                    damage: 50,
                    range: 100,
                    healing: 0,
                    armor: 10,
                },
                workbench: null,
                flavor_text: null,
                icon: '',
                loot_area: '',
                created_at: '',
                updated_at: '',
            };

            const stats = metaforge.formatItemStats(item);

            expect(stats).toContain('Damage: 50');
            expect(stats).toContain('Range: 100');
            expect(stats).toContain('Armor: 10');
            expect(stats).not.toContain('Healing');
        });

        it('should return empty array when no stat_block', () => {
            const item: ArcItem = {
                id: '1',
                name: 'Test',
                description: '',
                item_type: '',
                rarity: '',
                value: 0,
                weight: 0,
                loadout_slots: [],
                stat_block: {},
                workbench: null,
                flavor_text: null,
                icon: '',
                loot_area: '',
                created_at: '',
                updated_at: '',
            };

            const stats = metaforge.formatItemStats(item);

            expect(stats).toEqual([]);
        });
    });
});
