import motivationalConfigCommand from './motivational-config';
import { Context } from '../utils/types';

const mockContext: Context = {
    tables: {
        MotivationalConfig: {
            upsert: jest.fn(),
            findOne: jest.fn(),
            findAll: jest.fn(),
        },
    } as any,
    sequelize: {
        transaction: jest.fn((callback: any) => callback({
            commit: jest.fn(),
            rollback: jest.fn(),
        })),
    } as any,
    log: {
        error: jest.fn(),
        info: jest.fn(),
        warn: jest.fn(),
        debug: jest.fn(),
    } as any,
    VERSION: '2.0.0',
    COMMIT_SHA: 'test123',
};

const mockInteraction = {
    options: {
        getSubcommand: jest.fn(),
        getChannel: jest.fn(),
        getString: jest.fn(),
    },
    guildId: '123456789',
    guild: {
        channels: {
            cache: {
                get: jest.fn(),
            },
        },
    },
    reply: jest.fn(),
    editReply: jest.fn(),
    replied: false,
    deferred: false,
};

describe('motivational-config command', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        (mockContext.sequelize!.transaction as jest.Mock).mockImplementation((callback: any) =>
            callback({ commit: jest.fn(), rollback: jest.fn() }),
        );
    });

    describe('setup subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('setup');
        });

        it('should successfully set up a new motivational config', async () => {
            const mockChannel = {
                id: '987654321',
                type: 0, // GuildText
                toString: () => '#test-channel',
            };

            mockInteraction.options.getChannel.mockReturnValue(mockChannel);
            mockInteraction.options.getString.mockImplementation((name: string) => {
                switch (name) {
                    case 'frequency':
                        return 'daily';
                    case 'category':
                        return 'motivation';
                    case 'schedule':
                        return null;
                    default:
                        return null;
                }
            });

            (mockContext.tables!.MotivationalConfig.upsert as jest.Mock).mockResolvedValue([null, true]);

            await motivationalConfigCommand.execute(mockInteraction, mockContext);

            expect(mockContext.tables!.MotivationalConfig.upsert).toHaveBeenCalledWith({
                channelId: '987654321',
                guildId: '123456789',
                frequency: 'daily',
                category: 'motivation',
                cronSchedule: '0 9 * * *',
                isActive: true,
            }, { transaction: expect.any(Object) });

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('✅ Motivational messages configured'),
                ephemeral: true,
            });
        });

        it('should reject non-text channels', async () => {
            const mockChannel = {
                id: '987654321',
                type: 2, // GuildVoice
                toString: () => 'Voice Channel',
            };

            mockInteraction.options.getChannel.mockReturnValue(mockChannel);

            await motivationalConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Only text channels are supported'),
                ephemeral: true,
            });
        });

        it('should validate custom cron schedules', async () => {
            const mockChannel = {
                id: '987654321',
                type: 0, // GuildText
                toString: () => '#test-channel',
            };

            mockInteraction.options.getChannel.mockReturnValue(mockChannel);
            mockInteraction.options.getString.mockImplementation((name: string) => {
                switch (name) {
                    case 'frequency':
                        return 'daily';
                    case 'category':
                        return 'motivation';
                    case 'schedule':
                        return 'invalid-schedule';
                    default:
                        return null;
                }
            });

            await motivationalConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Invalid cron schedule format'),
                ephemeral: true,
            });
        });
    });

    describe('disable subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('disable');
        });

        it('should disable an existing configuration', async () => {
            const mockChannel = {
                id: '987654321',
                toString: () => '#test-channel',
            };

            const mockConfig = {
                update: jest.fn(),
            };

            mockInteraction.options.getChannel.mockReturnValue(mockChannel);
            (mockContext.tables!.MotivationalConfig.findOne as jest.Mock).mockResolvedValue(mockConfig);

            await motivationalConfigCommand.execute(mockInteraction, mockContext);

            expect(mockConfig.update).toHaveBeenCalledWith({ isActive: false }, { transaction: expect.any(Object) });
            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('❌ Motivational messages disabled'),
                ephemeral: true,
            });
        });

        it('should handle non-existent configuration', async () => {
            const mockChannel = {
                id: '987654321',
                toString: () => '#test-channel',
            };

            mockInteraction.options.getChannel.mockReturnValue(mockChannel);
            (mockContext.tables!.MotivationalConfig.findOne as jest.Mock).mockResolvedValue(null);

            await motivationalConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Error: No motivational message configuration found'),
                ephemeral: true,
            });
        });
    });

    describe('status subcommand', () => {
        beforeEach(() => {
            mockInteraction.options.getSubcommand.mockReturnValue('status');
        });

        it('should display status when configurations exist', async () => {
            const mockConfigs = [
                {
                    channelId: '987654321',
                    isActive: true,
                    frequency: 'daily',
                    category: 'motivation',
                    cronSchedule: '0 9 * * *',
                },
                {
                    channelId: '876543210',
                    isActive: false,
                    frequency: 'weekly',
                    category: 'productivity',
                    cronSchedule: '0 9 * * 1',
                },
            ];

            mockInteraction.guild.channels.cache.get.mockImplementation((id: string) => ({
                toString: () => id === '987654321' ? '#motivation' : '#productivity',
            }));

            (mockContext.tables!.MotivationalConfig.findAll as jest.Mock).mockResolvedValue(mockConfigs);

            await motivationalConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '📊 Status command received and processing...',
                flags: 64,
            });
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: `📊 Found ${mockConfigs.length} configuration(s) for this server.`,
            });
        });

        it('should display empty message when no configurations exist', async () => {
            (mockContext.tables!.MotivationalConfig.findAll as jest.Mock).mockResolvedValue([]);

            await motivationalConfigCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: '📊 Status command received and processing...',
                flags: 64,
            });
            expect(mockInteraction.editReply).toHaveBeenCalledWith({
                content: '📊 No motivational message configurations found for this server.',
            });
        });
    });
});