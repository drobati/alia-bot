import arc from './arc';
import metaforge from '../lib/apis/metaforge';

jest.mock('../lib/apis/metaforge', () => ({
    __esModule: true,
    default: {
        searchItems: jest.fn().mockResolvedValue([]),
        getItemByName: jest.fn().mockResolvedValue(null),
        getAllItems: jest.fn().mockResolvedValue({ data: [], pagination: {} }),
        formatItemStats: jest.fn().mockReturnValue([]),
        getEvents: jest.fn().mockResolvedValue([]),
        getUpcomingEvents: jest.fn().mockResolvedValue([]),
        getActiveEvents: jest.fn().mockResolvedValue([]),
        getEventsGroupedByMap: jest.fn().mockResolvedValue(new Map()),
    },
    RARITY_COLORS: {
        Common: 0x9d9d9d,
        Uncommon: 0x1eff00,
        Rare: 0x0070dd,
        Epic: 0xa335ee,
        Legendary: 0xff8000,
    },
    ARC_EVENT_TYPES: [
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
    ],
    ARC_MAPS: [
        'Spaceport',
        'Blue Gate',
        'Buried City',
        'Dam',
        'Stella Montis',
    ],
}));

const mockedMetaforge = metaforge as jest.Mocked<typeof metaforge>;

describe('Arc Command', () => {
    describe('command structure', () => {
        it('should have the correct name', () => {
            expect(arc.data.name).toBe('arc');
        });

        it('should have 6 subcommands/groups', () => {
            const json = arc.data.toJSON();
            expect(json.options).toBeDefined();
            expect(json.options!.length).toBe(6);
        });

        it('should have item subcommand with autocomplete', () => {
            const json = arc.data.toJSON();
            const item = json.options!.find((opt: any) => opt.name === 'item') as any;
            expect(item).toBeDefined();
            const nameOption = item!.options?.find((opt: any) => opt.name === 'name');
            expect(nameOption).toBeDefined();
            expect(nameOption.autocomplete).toBe(true);
            expect(nameOption.required).toBe(true);
        });

        it('should have need subcommand with item and notes options', () => {
            const json = arc.data.toJSON();
            const need = json.options!.find((opt: any) => opt.name === 'need') as any;
            expect(need).toBeDefined();
            const itemOption = need!.options?.find((opt: any) => opt.name === 'item');
            expect(itemOption).toBeDefined();
            expect(itemOption.autocomplete).toBe(true);
            expect(itemOption.required).toBe(true);
            const notesOption = need!.options?.find((opt: any) => opt.name === 'notes');
            expect(notesOption).toBeDefined();
            expect(notesOption.required).toBe(false);
        });

        it('should have wanted subcommand with page option', () => {
            const json = arc.data.toJSON();
            const wanted = json.options!.find((opt: any) => opt.name === 'wanted') as any;
            expect(wanted).toBeDefined();
            const pageOption = wanted!.options?.find((opt: any) => opt.name === 'page');
            expect(pageOption).toBeDefined();
            expect(pageOption.required).toBe(false);
        });

        it('should have found subcommand with autocomplete', () => {
            const json = arc.data.toJSON();
            const found = json.options!.find((opt: any) => opt.name === 'found') as any;
            expect(found).toBeDefined();
            const itemOption = found!.options?.find((opt: any) => opt.name === 'item');
            expect(itemOption).toBeDefined();
            expect(itemOption.autocomplete).toBe(true);
            expect(itemOption.required).toBe(true);
        });

        it('should have mywishlist subcommand with show_found option', () => {
            const json = arc.data.toJSON();
            const mywishlist = json.options!.find((opt: any) => opt.name === 'mywishlist') as any;
            expect(mywishlist).toBeDefined();
            const showFoundOption = mywishlist!.options?.find(
                (opt: any) => opt.name === 'show_found',
            );
            expect(showFoundOption).toBeDefined();
            expect(showFoundOption.required).toBe(false);
        });
    });

    describe('execute function', () => {
        const mockContext = {
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
            tables: {
                ArcWishlist: {
                    findOne: jest.fn(),
                    findAll: jest.fn(),
                    findAndCountAll: jest.fn(),
                    create: jest.fn(),
                },
            },
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('item subcommand', () => {
            it('should reply with item not found when item does not exist', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('item'),
                        getString: jest.fn().mockReturnValue('NonexistentItem'),
                    },
                    deferReply: jest.fn().mockResolvedValue(undefined),
                    editReply: jest.fn().mockResolvedValue(undefined),
                };

                mockedMetaforge.getItemByName.mockResolvedValue(null);

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.deferReply).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('not found'),
                });
            });

            it('should reply with item embed when item exists', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('item'),
                        getString: jest.fn().mockReturnValue('Test Item'),
                    },
                    deferReply: jest.fn().mockResolvedValue(undefined),
                    editReply: jest.fn().mockResolvedValue(undefined),
                };

                mockedMetaforge.getItemByName.mockResolvedValue({
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
                    icon: '',
                    loot_area: 'Test Area',
                    created_at: '',
                    updated_at: '',
                });

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    embeds: expect.any(Array),
                });
            });

            it('should include Used In field when flavor_text is present', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('item'),
                        getString: jest.fn().mockReturnValue('Chemicals'),
                    },
                    deferReply: jest.fn().mockResolvedValue(undefined),
                    editReply: jest.fn().mockResolvedValue(undefined),
                };

                mockedMetaforge.getItemByName.mockResolvedValue({
                    id: 'chemicals',
                    name: 'Chemicals',
                    description: 'Used to craft medical supplies, explosives, and utility items.',
                    item_type: 'Basic Material',
                    rarity: 'Common',
                    value: 50,
                    weight: 1,
                    loadout_slots: [],
                    stat_block: {},
                    workbench: null,
                    flavor_text: 'Used to craft: Bandage, Medkit, Grenade',
                    icon: '',
                    loot_area: 'Mechanical',
                    created_at: '',
                    updated_at: '',
                });

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: 'Used In',
                                        value: 'Used to craft: Bandage, Medkit, Grenade',
                                    }),
                                ]),
                            }),
                        }),
                    ]),
                });
            });
        });

        describe('need subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('need'),
                        getString: jest.fn().mockReturnValue('Test Item'),
                    },
                    guild: null,
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should add item to wishlist when not already present', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('need'),
                        getString: jest.fn((name: string) => {
                            if (name === 'item') {return 'Test Item';}
                            return null;
                        }),
                    },
                    guild: { id: 'guild123' },
                    user: { id: 'user123', username: 'TestUser' },
                    deferReply: jest.fn().mockResolvedValue(undefined),
                    editReply: jest.fn().mockResolvedValue(undefined),
                };

                mockedMetaforge.getItemByName.mockResolvedValue({
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
                    icon: '',
                    loot_area: '',
                    created_at: '',
                    updated_at: '',
                });
                mockContext.tables.ArcWishlist.findOne.mockResolvedValue(null);
                mockContext.tables.ArcWishlist.create.mockResolvedValue({});

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockContext.tables.ArcWishlist.create).toHaveBeenCalledWith({
                    guild_id: 'guild123',
                    user_id: 'user123',
                    username: 'TestUser',
                    item_name: 'Test Item',
                    item_id: '1',
                    status: 'needed',
                    notes: undefined,
                });
                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('has been added'),
                });
            });

            it('should notify when item already on wishlist', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('need'),
                        getString: jest.fn((name: string) => {
                            if (name === 'item') {return 'Test Item';}
                            return null;
                        }),
                    },
                    guild: { id: 'guild123' },
                    user: { id: 'user123', username: 'TestUser' },
                    deferReply: jest.fn().mockResolvedValue(undefined),
                    editReply: jest.fn().mockResolvedValue(undefined),
                };

                mockedMetaforge.getItemByName.mockResolvedValue({
                    id: '1',
                    name: 'Test Item',
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
                });
                mockContext.tables.ArcWishlist.findOne.mockResolvedValue({
                    status: 'needed',
                });

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('already on your wishlist'),
                });
            });
        });

        describe('wanted subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('wanted'),
                        getInteger: jest.fn().mockReturnValue(null),
                    },
                    guild: null,
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should show empty message when no items wanted', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('wanted'),
                        getInteger: jest.fn().mockReturnValue(null),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                mockContext.tables.ArcWishlist.findAndCountAll.mockResolvedValue({
                    count: 0,
                    rows: [],
                });

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No items are currently wanted'),
                });
            });

            it('should display wanted items grouped by user', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('wanted'),
                        getInteger: jest.fn().mockReturnValue(null),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                mockContext.tables.ArcWishlist.findAndCountAll.mockResolvedValue({
                    count: 2,
                    rows: [
                        { username: 'User1', user_id: 'u1', item_name: 'Item A' },
                        { username: 'User1', user_id: 'u1', item_name: 'Item B' },
                    ],
                });

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    embeds: expect.any(Array),
                });
            });
        });

        describe('found subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('found'),
                        getString: jest.fn().mockReturnValue('Test Item'),
                    },
                    guild: null,
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should notify when item not on wishlist', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('found'),
                        getString: jest.fn().mockReturnValue('Test Item'),
                    },
                    guild: { id: 'guild123' },
                    user: { id: 'user123' },
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                mockContext.tables.ArcWishlist.findOne.mockResolvedValue(null);

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('not on your wishlist'),
                    ephemeral: true,
                });
            });

            it('should mark item as found', async () => {
                const mockUpdate = jest.fn().mockResolvedValue({});
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('found'),
                        getString: jest.fn().mockReturnValue('Test Item'),
                    },
                    guild: { id: 'guild123' },
                    user: { id: 'user123' },
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                mockContext.tables.ArcWishlist.findOne.mockResolvedValue({
                    status: 'needed',
                    update: mockUpdate,
                });

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockUpdate).toHaveBeenCalledWith({
                    status: 'found',
                    found_at: expect.any(Date),
                });
                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('has been marked as found'),
                });
            });
        });

        describe('mywishlist subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('mywishlist'),
                        getBoolean: jest.fn().mockReturnValue(false),
                    },
                    guild: null,
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should show empty message when wishlist is empty', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('mywishlist'),
                        getBoolean: jest.fn().mockReturnValue(false),
                    },
                    guild: { id: 'guild123' },
                    user: { id: 'user123', username: 'TestUser' },
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                mockContext.tables.ArcWishlist.findAll.mockResolvedValue([]);

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('no items needed'),
                    ephemeral: true,
                });
            });

            it('should display wishlist with items', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('mywishlist'),
                        getBoolean: jest.fn().mockReturnValue(false),
                    },
                    guild: { id: 'guild123' },
                    user: { id: 'user123', username: 'TestUser' },
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                mockContext.tables.ArcWishlist.findAll.mockResolvedValue([
                    { item_name: 'Item A', status: 'needed', notes: null },
                    { item_name: 'Item B', status: 'needed', notes: 'urgent' },
                ]);

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    embeds: expect.any(Array),
                    ephemeral: true,
                });
            });
        });

        describe('unknown subcommand', () => {
            it('should reply with unknown subcommand message', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: jest.fn().mockReturnValue('unknown'),
                    },
                    reply: jest.fn().mockResolvedValue(undefined),
                };

                await arc.execute(mockInteraction, mockContext as any);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'Unknown subcommand.',
                    ephemeral: true,
                });
            });
        });
    });

    describe('autocomplete function', () => {
        const mockContext = {
            tables: {
                ArcWishlist: {
                    findAll: jest.fn(),
                },
            },
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        it('should return empty for short search queries', async () => {
            const mockInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'name', value: 'a' }),
                    getSubcommand: jest.fn().mockReturnValue('item'),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            };

            await arc.autocomplete(mockInteraction, mockContext as any);

            expect(mockInteraction.respond).toHaveBeenCalledWith([]);
        });

        it('should search API for item subcommand', async () => {
            const mockInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'name', value: 'test' }),
                    getSubcommand: jest.fn().mockReturnValue('item'),
                },
                respond: jest.fn().mockResolvedValue(undefined),
            };

            mockedMetaforge.searchItems.mockResolvedValue([
                {
                    id: '1',
                    name: 'Test Item',
                    rarity: 'Rare',
                    description: '',
                    item_type: '',
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
            ]);

            await arc.autocomplete(mockInteraction, mockContext as any);

            expect(mockedMetaforge.searchItems).toHaveBeenCalledWith('test', 25);
            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: 'Test Item (Rare)', value: 'Test Item' },
            ]);
        });

        it('should search wishlist for found subcommand', async () => {
            const mockInteraction = {
                options: {
                    getFocused: jest.fn().mockReturnValue({ name: 'item', value: 'test' }),
                    getSubcommand: jest.fn().mockReturnValue('found'),
                },
                guild: { id: 'guild123' },
                user: { id: 'user123' },
                respond: jest.fn().mockResolvedValue(undefined),
            };

            mockContext.tables.ArcWishlist.findAll.mockResolvedValue([
                { item_name: 'Test Item A' },
                { item_name: 'Test Item B' },
            ]);

            await arc.autocomplete(mockInteraction, mockContext as any);

            expect(mockContext.tables.ArcWishlist.findAll).toHaveBeenCalledWith({
                where: {
                    guild_id: 'guild123',
                    user_id: 'user123',
                    status: 'needed',
                },
                order: [['item_name', 'ASC']],
            });
            expect(mockInteraction.respond).toHaveBeenCalledWith([
                { name: 'Test Item A', value: 'Test Item A' },
                { name: 'Test Item B', value: 'Test Item B' },
            ]);
        });
    });
});
