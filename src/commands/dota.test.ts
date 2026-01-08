import dota from './dota';

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

        it('should handle register subcommand', async () => {
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

            // This will fail without real API, but tests the flow
            await dota.execute(mockInteraction, mockContext);

            expect(mockInteraction.deferReply).toHaveBeenCalledWith({ ephemeral: true });
        });

        it('should handle unregister subcommand when not registered', async () => {
            const mockInteraction = {
                options: {
                    getSubcommand: () => 'unregister',
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

        it('should handle leaderboard subcommand with no users', async () => {
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
                content: 'No users are registered for the Dota leaderboard yet. Use `/dota register` to be the first!',
                ephemeral: true,
            });
        });
    });
});
