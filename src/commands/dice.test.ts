import { describe, it, expect, beforeEach, jest } from '@jest/globals';

const mockCustomDice = {
    create: jest.fn<any>(),
    findOne: jest.fn<any>(),
    findAll: jest.fn<any>(),
    destroy: jest.fn<any>(),
};

const mockConfig = {
    findOne: jest.fn<any>(),
    upsert: jest.fn<any>(),
};

const mockContext = {
    tables: {
        CustomDice: mockCustomDice,
        Config: mockConfig,
    },
    log: {
        info: jest.fn<any>(),
        error: jest.fn<any>(),
    },
};

const createMockInteraction = (overrides: any = {}) => ({
    options: {
        getSubcommand: jest.fn<any>().mockReturnValue('roll'),
        getSubcommandGroup: jest.fn<any>().mockReturnValue(null),
        getString: jest.fn<any>(),
        getInteger: jest.fn<any>(),
        getFocused: jest.fn<any>().mockReturnValue(''),
    },
    reply: jest.fn<any>(),
    followUp: jest.fn<any>(),
    respond: jest.fn<any>(),
    user: {
        id: 'test-user-id',
        username: 'testuser',
    },
    channelId: 'test-channel-id',
    guildId: 'test-guild-id',
    replied: false,
    deferred: false,
    ...overrides,
});

describe('Dice Command', () => {
    let diceCommand: any;

    beforeEach(async () => {
        jest.clearAllMocks();
        jest.resetModules();

        // Mock config to return defaults
        mockConfig.findOne.mockResolvedValue(null);

        // Import after mocking
        diceCommand = (await import('./dice')).default;
    });

    describe('Command Data', () => {
        it('should have correct name and description', () => {
            expect(diceCommand.data.name).toBe('dice');
            expect(diceCommand.data.description).toContain('Roll dice');
        });

        it('should have roll subcommand', () => {
            const subcommands = diceCommand.data.options;
            const rollSubcommand = subcommands.find((opt: any) => opt.name === 'roll');
            expect(rollSubcommand).toBeDefined();
        });

        it('should have coin subcommand', () => {
            const subcommands = diceCommand.data.options;
            const coinSubcommand = subcommands.find((opt: any) => opt.name === 'coin');
            expect(coinSubcommand).toBeDefined();
        });

        it('should have custom subcommand group', () => {
            const subcommands = diceCommand.data.options;
            const customGroup = subcommands.find((opt: any) => opt.name === 'custom');
            expect(customGroup).toBeDefined();
        });
    });

    describe('Roll Subcommand', () => {
        it('should roll basic dice notation', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('2d6');

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toMatch(/I rolled/);
        });

        it('should handle invalid dice notation', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('invalid');

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('Invalid dice notation');
            expect(response.ephemeral).toBe(true);
        });

        it('should reject too many dice', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('1000d6');

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('not going to roll more than');
            expect(response.ephemeral).toBe(true);
        });

        it('should reject dice with less than 2 sides', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('2d1');

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('less than two sides');
            expect(response.ephemeral).toBe(true);
        });

        it('should handle dice with modifier', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('1d20+5');

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toMatch(/modifier/);
        });

        it('should handle fudge dice', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('4dF');

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toMatch(/I rolled/);
        });
    });

    describe('Coin Subcommand', () => {
        it('should flip a coin', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommand.mockReturnValue('coin');

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toMatch(/Heads|Tails/);
        });
    });

    describe('Custom Dice - Create', () => {
        it('should create a custom die', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('create');
            mockInteraction.options.getString.mockImplementation((key: string) => {
                if (key === 'name') {
                    return 'direction';
                }
                if (key === 'sides') {
                    return 'North, South, East, West';
                }
                return null;
            });

            mockCustomDice.findOne.mockResolvedValue(null);
            mockCustomDice.create.mockResolvedValue({});

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockCustomDice.create).toHaveBeenCalledWith({
                guild_id: 'test-guild-id',
                name: 'direction',
                sides: JSON.stringify(['North', 'South', 'East', 'West']),
                creator_id: 'test-user-id',
            });
        });

        it('should reject duplicate custom die names', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('create');
            mockInteraction.options.getString.mockImplementation((key: string) => {
                if (key === 'name') {
                    return 'existing';
                }
                if (key === 'sides') {
                    return 'A, B';
                }
                return null;
            });

            mockCustomDice.findOne.mockResolvedValue({ name: 'existing' });

            await diceCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('already exists');
            expect(response.ephemeral).toBe(true);
        });

        it('should reject die with less than 2 sides', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('create');
            mockInteraction.options.getString.mockImplementation((key: string) => {
                if (key === 'name') {
                    return 'single';
                }
                if (key === 'sides') {
                    return 'Only';
                }
                return null;
            });

            await diceCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('at least 2 sides');
            expect(response.ephemeral).toBe(true);
        });
    });

    describe('Custom Dice - Roll', () => {
        it('should roll a custom die', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('direction');
            mockInteraction.options.getInteger.mockReturnValue(1);

            mockCustomDice.findOne.mockResolvedValue({
                name: 'direction',
                sides: JSON.stringify(['North', 'South', 'East', 'West']),
            });

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toMatch(/Rolling.*direction/);
        });

        it('should handle non-existent custom die', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('roll');
            mockInteraction.options.getString.mockReturnValue('nonexistent');
            mockInteraction.options.getInteger.mockReturnValue(1);

            mockCustomDice.findOne.mockResolvedValue(null);

            await diceCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('No custom die named');
            expect(response.ephemeral).toBe(true);
        });
    });

    describe('Custom Dice - List', () => {
        it('should list custom dice', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('list');

            mockCustomDice.findAll.mockResolvedValue([
                { name: 'direction', sides: JSON.stringify(['N', 'S', 'E', 'W']) },
                { name: 'mood', sides: JSON.stringify(['Happy', 'Sad', 'Angry']) },
            ]);

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.embeds).toBeDefined();
            expect(response.embeds[0].data.title).toContain('Custom Dice');
        });

        it('should handle no custom dice', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('list');

            mockCustomDice.findAll.mockResolvedValue([]);

            await diceCommand.execute(mockInteraction, mockContext);

            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('No custom dice');
            expect(response.ephemeral).toBe(true);
        });
    });

    describe('Custom Dice - Delete', () => {
        it('should delete a custom die', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getSubcommandGroup.mockReturnValue('custom');
            mockInteraction.options.getSubcommand.mockReturnValue('delete');
            mockInteraction.options.getString.mockReturnValue('direction');

            const mockDie = {
                name: 'direction',
                destroy: jest.fn<any>().mockResolvedValue(undefined),
            };
            mockCustomDice.findOne.mockResolvedValue(mockDie);

            await diceCommand.execute(mockInteraction, mockContext);

            expect(mockDie.destroy).toHaveBeenCalled();
            const response = mockInteraction.reply.mock.calls[0][0];
            expect(response.content).toContain('deleted');
        });
    });

    describe('Autocomplete', () => {
        it('should provide autocomplete for custom dice names', async () => {
            const mockInteraction = createMockInteraction();
            mockInteraction.options.getFocused.mockReturnValue('dir');

            mockCustomDice.findAll.mockResolvedValue([
                { name: 'direction' },
            ]);

            await diceCommand.autocomplete(mockInteraction, mockContext);

            expect(mockInteraction.respond).toHaveBeenCalled();
            const choices = mockInteraction.respond.mock.calls[0][0];
            expect(choices).toContainEqual({ name: 'direction', value: 'direction' });
        });
    });
});
