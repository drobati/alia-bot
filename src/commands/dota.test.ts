import dota from './dota';
import opendota from '../lib/apis/opendota';

jest.mock('../lib/apis/opendota', () => ({
    __esModule: true,
    default: {
        normalizeSteamId: jest.fn((id: string) => id),
        getPlayer: jest.fn().mockResolvedValue(null),
        getWinLoss: jest.fn().mockResolvedValue(null),
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
            expect(json.options!.length).toBe(4);
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

        it('should have profile subcommand', () => {
            const json = dota.data.toJSON();
            const profile = json.options!.find((opt: any) => opt.name === 'profile');
            expect(profile).toBeDefined();
        });

        it('should have leaderboard subcommand with timeframe option', () => {
            const json = dota.data.toJSON();
            const leaderboard = json.options!.find((opt: any) => opt.name === 'leaderboard') as any;
            expect(leaderboard).toBeDefined();
            expect(leaderboard!.options[0].name).toBe('timeframe');
            expect(leaderboard!.options[0].choices).toHaveLength(3);
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
        });

        describe('leaderboard subcommand', () => {
            it('should reject when not in a guild', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: () => 'month',
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
                        getString: () => 'month',
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
                        getString: () => 'week',
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
                        getString: () => 'all',
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
                    content: expect.stringContaining('No players have games recorded'),
                });
            });

            it('should handle leaderboard errors', async () => {
                const mockInteraction = {
                    options: {
                        getSubcommand: () => 'leaderboard',
                        getString: () => 'month',
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
                        getString: () => 'month',
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
    });
});
