import dota from './dota';
import opendota from '../lib/apis/opendota';

jest.mock('../lib/apis/opendota', () => ({
    __esModule: true,
    default: {
        normalizeSteamId: jest.fn((id: string) => id),
        getPlayer: jest.fn().mockResolvedValue(null),
        getWinLoss: jest.fn().mockResolvedValue(null),
        getHeroes: jest.fn().mockResolvedValue([]),
        getRecentMatches: jest.fn().mockResolvedValue([]),
        getTotals: jest.fn().mockResolvedValue([]),
        getPeers: jest.fn().mockResolvedValue([]),
        getMatch: jest.fn().mockResolvedValue(null),
        getHeroConstants: jest.fn().mockResolvedValue({}),
        getHeroName: jest.fn().mockResolvedValue('Unknown Hero'),
        MODE_PRESETS: {
            all: { significant: 0 },      // All games including Turbo
            ranked: { significant: 1 },   // Excludes Turbo
        },
    },
}));

const mockedOpendota = opendota as jest.Mocked<typeof opendota>;

describe('Dota Command', () => {
    describe('command structure', () => {
        it('should have the correct name', () => {
            expect(dota.data.name).toBe('dota');
        });

        it('should have subcommands', () => {
            const json = dota.data.toJSON();
            expect(json.options).toBeDefined();
            expect(json.options!.length).toBe(11);
        });

        it('should have register subcommand', () => {
            const json = dota.data.toJSON();
            const register = json.options!.find((opt: any) => opt.name === 'register') as any;
            expect(register).toBeDefined();
            expect(register!.options[0].name).toBe('steam_id');
            expect(register!.options[0].required).toBe(true);
        });

        it('should have unregister subcommand', () => {
            const json = dota.data.toJSON();
            const unregister = json.options!.find((opt: any) => opt.name === 'unregister');
            expect(unregister).toBeDefined();
        });

        it('should have profile subcommand with mode option', () => {
            const json = dota.data.toJSON();
            const profile = json.options!.find((opt: any) => opt.name === 'profile') as any;
            expect(profile).toBeDefined();
            const modeOption = profile!.options.find((opt: any) => opt.name === 'mode');
            expect(modeOption).toBeDefined();
            expect(modeOption.choices).toHaveLength(2);
        });

        it('should have leaderboard subcommand with timeframe and mode options', () => {
            const json = dota.data.toJSON();
            const leaderboard = json.options!.find((opt: any) => opt.name === 'leaderboard') as any;
            expect(leaderboard).toBeDefined();
            expect(leaderboard!.options[0].name).toBe('timeframe');
            expect(leaderboard!.options[0].choices).toHaveLength(3);
            const modeOption = leaderboard!.options.find((opt: any) => opt.name === 'mode');
            expect(modeOption).toBeDefined();
            expect(modeOption.choices).toHaveLength(2);
        });
    });

    describe('execute function', () => {
        const mockContext = {
            tables: {
                DotaUsers: {
                    findOne: jest.fn(),
                    findAll: jest.fn(),
                    create: jest.fn(),
                },
            },
            log: {
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
        };

        beforeEach(() => {
            jest.clearAllMocks();
        });

        describe('register subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'register',
                        getString: () => '123456789',
                    },
                    user: { id: 'discord123' },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should reject already registered users', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'register',
                        getString: () => '123456789',
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('You are already registered'),
                    ephemeral: true,
                });
            });

            it('should register new user successfully', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'register',
                        getString: () => '123456789',
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(null);
                mockedOpendota.getPlayer.mockResolvedValue({
                    profile: {
                        account_id: 123456789,
                        personaname: 'TestPlayer',
                        name: null,
                        avatar: 'avatar.jpg',
                        avatarfull: 'avatarfull.jpg',
                        steamid: '76561198083722517',
                        profileurl: 'https://steamcommunity.com/id/test',
                    },
                });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
                expect(mockContext.tables.DotaUsers.create).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('Successfully registered'),
                });
            });

            it('should reject invalid Steam ID', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'register',
                        getString: () => 'invalid',
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(null);
                mockedOpendota.getPlayer.mockResolvedValue(null);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('Could not find a Dota 2 player'),
                });
            });

            it('should handle API errors gracefully', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'register',
                        getString: () => '123456789',
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(null);
                mockedOpendota.getPlayer.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while registering. Please try again later.',
                });
            });
        });

        describe('unregister subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: { getSubcommand: () => 'unregister' },
                    user: { id: 'discord123' },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should handle unregister when not registered', async () => {
                const mockInteraction = {
                    options: { getSubcommand: () => 'unregister' },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(null);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'You are not registered. Use `/dota register` to register your Steam ID.',
                    ephemeral: true,
                });
            });

            it('should successfully unregister user', async () => {
                const mockRecord = {
                    steam_username: 'TestPlayer',
                    destroy: jest.fn().mockResolvedValue(undefined),
                };
                const mockInteraction = {
                    options: { getSubcommand: () => 'unregister' },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(mockRecord);

                await dota.execute(mockInteraction, mockContext);

                expect(mockRecord.destroy).toHaveBeenCalledWith({ force: true });
                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('Successfully unregistered'),
                    ephemeral: true,
                });
            });

            it('should handle errors gracefully', async () => {
                const mockInteraction = {
                    options: { getSubcommand: () => 'unregister' },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockRejectedValue(new Error('DB error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'An error occurred while unregistering. Please try again later.',
                    ephemeral: true,
                });
            });
        });

        describe('profile subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'profile',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should show not registered message for self', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'profile',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123', username: 'TestUser' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(null);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'You are not registered. Use `/dota register` to register your Steam ID.',
                    ephemeral: true,
                });
            });

            it('should show not registered message for other user', async () => {
                const otherUser = { id: 'other123', username: 'OtherUser' };
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'profile',
                        getUser: () => otherUser,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(null);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'OtherUser is not registered for the Dota leaderboard.',
                    ephemeral: true,
                });
            });

            it('should handle private profile', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'profile',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });

                mockedOpendota.getPlayer.mockResolvedValue({});

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('Could not fetch player data'),
                });
            });

            it('should handle profile errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'profile',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });

                mockedOpendota.getPlayer.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while fetching the profile. Please try again later.',
                });
            });

            it('should filter by ranked mode when specified', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'profile',
                        getUser: () => null,
                        getString: (name: string) => name === 'mode' ? 'ranked' : null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });

                mockedOpendota.getPlayer.mockResolvedValue({});

                await dota.execute(mockInteraction, mockContext);

                // Verify getWinLoss was called with significant=1 (excludes Turbo)
                expect(mockedOpendota.getWinLoss).toHaveBeenCalledWith(
                    '123456789',
                    expect.objectContaining({ significant: 1 }),
                );
            });

            it('should include Turbo by default (all mode)', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'profile',
                        getUser: () => null,
                        getString: () => null, // default to 'all'
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });

                mockedOpendota.getPlayer.mockResolvedValue({});

                await dota.execute(mockInteraction, mockContext);

                // Verify getWinLoss was called with significant=0 (includes Turbo)
                expect(mockedOpendota.getWinLoss).toHaveBeenCalledWith(
                    '123456789',
                    expect.objectContaining({ significant: 0 }),
                );
            });
        });

        describe('leaderboard subcommand', () => {
            // Helper to create getString mock for leaderboard
            const createGetString = (timeframe: string, mode: string | null = null) =>
                (name: string) => {
                    if (name === 'timeframe') {return timeframe;}
                    if (name === 'mode') {return mode;}
                    return null;
                };

            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('month'),
                    },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should handle leaderboard with no users', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('month'),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findAll.mockResolvedValue([]);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No users are registered'),
                    ephemeral: true,
                });
            });

            it('should show leaderboard with qualified players', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('week'),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findAll.mockResolvedValue([
                    { discord_id: 'user1', steam_id: '111', steam_username: 'Player1' },
                    { discord_id: 'user2', steam_id: '222', steam_username: 'Player2' },
                ]);

                mockedOpendota.getWinLoss
                    .mockResolvedValueOnce({ win: 10, lose: 5 })
                    .mockResolvedValueOnce({ win: 8, lose: 7 });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.deferReply).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    embeds: expect.any(Array),
                });
            });

            it('should show message when no players have games', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('all'),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findAll.mockResolvedValue([
                    { discord_id: 'user1', steam_id: '111', steam_username: 'Player1' },
                ]);

                mockedOpendota.getWinLoss.mockResolvedValue({ win: 0, lose: 0 });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No players have'),
                });
            });

            it('should handle leaderboard errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('month'),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findAll.mockRejectedValue(new Error('DB error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while generating the leaderboard. Please try again later.',
                });
            });

            it('should show unqualified players section', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('month'),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findAll.mockResolvedValue([
                    { discord_id: 'user1', steam_id: '111', steam_username: 'QualifiedPlayer' },
                    { discord_id: 'user2', steam_id: '222', steam_username: 'NewPlayer' },
                ]);

                mockedOpendota.getWinLoss
                    .mockResolvedValueOnce({ win: 10, lose: 5 })
                    .mockResolvedValueOnce({ win: 2, lose: 1 });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    embeds: expect.arrayContaining([
                        expect.objectContaining({
                            data: expect.objectContaining({
                                fields: expect.arrayContaining([
                                    expect.objectContaining({
                                        name: expect.stringContaining('Need'),
                                    }),
                                ]),
                            }),
                        }),
                    ]),
                });
            });

            it('should filter by ranked mode when specified', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('month', 'ranked'),
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findAll.mockResolvedValue([
                    { discord_id: 'user1', steam_id: '111', steam_username: 'Player1' },
                ]);

                mockedOpendota.getWinLoss.mockResolvedValue({ win: 10, lose: 5 });

                await dota.execute(mockInteraction, mockContext);

                // Verify getWinLoss was called with significant=1 (excludes Turbo)
                expect(mockedOpendota.getWinLoss).toHaveBeenCalledWith(
                    '111',
                    expect.objectContaining({ significant: 1 }),
                );
            });

            it('should include Turbo by default (all mode)', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: createGetString('month', null), // default to 'all'
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findAll.mockResolvedValue([
                    { discord_id: 'user1', steam_id: '111', steam_username: 'Player1' },
                ]);

                mockedOpendota.getWinLoss.mockResolvedValue({ win: 10, lose: 5 });

                await dota.execute(mockInteraction, mockContext);

                // Verify getWinLoss was called with significant=0 (includes Turbo)
                expect(mockedOpendota.getWinLoss).toHaveBeenCalledWith(
                    '111',
                    expect.objectContaining({ significant: 0 }),
                );
            });
        });

        describe('unknown subcommand', () => {
            it('should handle unknown subcommand', async () => {
                const mockInteraction = {
                    options: { getSubcommand: () => 'unknown' },
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'Unknown subcommand.',
                    ephemeral: true,
                });
            });
        });

        describe('heroes subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'heroes',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should show not registered message', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'heroes',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue(null);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'You are not registered. Use `/dota register` to register your Steam ID.',
                    ephemeral: true,
                });
            });

            it('should handle no hero data', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'heroes',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                    steam_username: 'TestPlayer',
                });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No hero data'),
                });
            });

            it('should handle API errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'heroes',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });
                mockedOpendota.getHeroes.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while fetching hero data.',
                    ephemeral: true,
                });
            });
        });

        describe('recent subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'recent',
                        getUser: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should handle no recent matches', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'recent',
                        getUser: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                    steam_username: 'TestPlayer',
                });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No recent matches'),
                });
            });

            it('should handle API errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'recent',
                        getUser: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });
                mockedOpendota.getRecentMatches.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while fetching recent matches.',
                    ephemeral: true,
                });
            });
        });

        describe('totals subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'totals',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should handle no totals data', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'totals',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                    steam_username: 'TestPlayer',
                });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No stats data'),
                });
            });

            it('should handle API errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'totals',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });
                mockedOpendota.getTotals.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while fetching stats.',
                    ephemeral: true,
                });
            });
        });

        describe('peers subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'peers',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should handle no peers data', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'peers',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                    steam_username: 'TestPlayer',
                });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: expect.stringContaining('No peer data'),
                });
            });

            it('should handle API errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'peers',
                        getUser: () => null,
                        getString: () => null,
                    },
                    user: { id: 'discord123' },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findOne.mockResolvedValue({
                    steam_id: '123456789',
                });
                mockedOpendota.getPeers.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while fetching peer data.',
                    ephemeral: true,
                });
            });
        });

        describe('match subcommand', () => {
            it('should display match details successfully', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'match',
                        getString: () => '7654321',
                    },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockedOpendota.getMatch.mockResolvedValue({
                    match_id: 7654321,
                    duration: 2400,
                    start_time: Date.now() / 1000,
                    radiant_win: true,
                    radiant_score: 35,
                    dire_score: 28,
                    game_mode: 22,
                    lobby_type: 7,
                    players: [
                        {
                            account_id: 111, player_slot: 0, hero_id: 1,
                            kills: 10, deaths: 5, assists: 15,
                            last_hits: 200, denies: 10, gold_per_min: 500,
                            xp_per_min: 600, level: 25, net_worth: 20000,
                            personaname: 'Player1', isRadiant: true,
                        },
                    ],
                });
                mockedOpendota.getHeroName.mockResolvedValue('Anti-Mage');

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.deferReply).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    embeds: expect.any(Array),
                });
            });

            it('should handle match not found', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'match',
                        getString: () => '999999999',
                    },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockedOpendota.getMatch.mockResolvedValue(null);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'Match 999999999 not found.',
                });
            });

            it('should handle API errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'match',
                        getString: () => '7654321',
                    },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockedOpendota.getMatch.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while fetching match data.',
                    ephemeral: true,
                });
            });
        });

        describe('random subcommand', () => {
            it('should display random hero successfully', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'random',
                        getString: () => null,
                    },
                    reply: jest.fn(),
                };

                mockedOpendota.getHeroConstants.mockResolvedValue({
                    1: {
                        id: 1,
                        name: 'npc_dota_hero_antimage',
                        localized_name: 'Anti-Mage',
                        primary_attr: 'agi',
                        attack_type: 'Melee',
                        roles: ['Carry', 'Escape'],
                        img: '/apps/dota2/images/heroes/antimage_full.png',
                        icon: '/apps/dota2/images/heroes/antimage_icon.png',
                    },
                });

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    embeds: expect.any(Array),
                });
            });

            it('should handle no hero data', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'random',
                        getString: () => null,
                    },
                    reply: jest.fn(),
                };

                mockedOpendota.getHeroConstants.mockResolvedValue({});

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'Could not fetch hero list.',
                    ephemeral: true,
                });
            });

            it('should handle API errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'random',
                        getString: () => null,
                    },
                    reply: jest.fn(),
                };

                mockedOpendota.getHeroConstants.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'An error occurred while picking a random hero.',
                    ephemeral: true,
                });
            });
        });

        describe('compare subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'compare',
                        getUser: (name: string) => name === 'user1' ?
                            { id: 'user1', username: 'User1' } : { id: 'user2', username: 'User2' },
                        getString: () => null,
                    },
                    guild: null,
                    reply: jest.fn(),
                };

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'This command can only be used in a server.',
                    ephemeral: true,
                });
            });

            it('should compare two users successfully', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'compare',
                        getUser: (name: string) => name === 'user1' ?
                            { id: 'user1', username: 'User1' } : { id: 'user2', username: 'User2' },
                        getString: () => null,
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne
                    .mockResolvedValueOnce({ steam_id: '111', steam_username: 'Player1' })
                    .mockResolvedValueOnce({ steam_id: '222', steam_username: 'Player2' });

                mockedOpendota.getWinLoss
                    .mockResolvedValueOnce({ win: 100, lose: 50 })
                    .mockResolvedValueOnce({ win: 80, lose: 70 });

                mockedOpendota.getTotals
                    .mockResolvedValueOnce([
                        { field: 'kills', n: 150, sum: 1500 },
                        { field: 'deaths', n: 150, sum: 750 },
                        { field: 'assists', n: 150, sum: 1200 },
                    ])
                    .mockResolvedValueOnce([
                        { field: 'kills', n: 150, sum: 1200 },
                        { field: 'deaths', n: 150, sum: 900 },
                        { field: 'assists', n: 150, sum: 1100 },
                    ]);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.deferReply).toHaveBeenCalled();
                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    embeds: expect.any(Array),
                });
            });

            it('should handle user not registered', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'compare',
                        getUser: (name: string) => name === 'user1' ?
                            { id: 'user1', username: 'User1' } : { id: 'user2', username: 'User2' },
                        getString: () => null,
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                };

                mockContext.tables.DotaUsers.findOne
                    .mockResolvedValueOnce({ steam_id: '111', steam_username: 'Player1' })
                    .mockResolvedValueOnce(null);

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.reply).toHaveBeenCalledWith({
                    content: 'User2 is not registered for the Dota leaderboard.',
                    ephemeral: true,
                });
            });

            it('should handle API errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'compare',
                        getUser: (name: string) => name === 'user1' ?
                            { id: 'user1', username: 'User1' } : { id: 'user2', username: 'User2' },
                        getString: () => null,
                    },
                    guild: { id: 'guild123' },
                    reply: jest.fn(),
                    deferReply: jest.fn(),
                    editReply: jest.fn(),
                    deferred: true,
                };

                mockContext.tables.DotaUsers.findOne
                    .mockResolvedValueOnce({ steam_id: '111', steam_username: 'Player1' })
                    .mockResolvedValueOnce({ steam_id: '222', steam_username: 'Player2' });

                mockedOpendota.getWinLoss.mockRejectedValue(new Error('API error'));

                await dota.execute(mockInteraction, mockContext);

                expect(mockInteraction.editReply).toHaveBeenCalledWith({
                    content: 'An error occurred while comparing players.',
                    ephemeral: true,
                });
            });
        });
    });
});
