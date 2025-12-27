import { EngagementService } from './engagementService';
import { Context } from '../utils/types';

// Mock node-cron
jest.mock('node-cron', () => ({
    schedule: jest.fn(() => ({
        stop: jest.fn(),
    })),
}));

describe('EngagementService', () => {
    let engagementService: EngagementService;
    let mockContext: Context;
    let mockUserStats: any;

    beforeEach(() => {
        jest.clearAllMocks();

        mockUserStats = {
            findOne: jest.fn(),
            findAll: jest.fn(),
            create: jest.fn(),
            count: jest.fn(),
        };

        mockContext = {
            tables: {
                UserStats: mockUserStats,
            },
            log: {
                debug: jest.fn(),
                info: jest.fn(),
                error: jest.fn(),
                warn: jest.fn(),
            },
        } as any;

        engagementService = new EngagementService(mockContext);
    });

    describe('initialize', () => {
        it('should start the flush scheduler', () => {
            const cron = jest.requireMock('node-cron');

            engagementService.initialize();

            expect(cron.schedule).toHaveBeenCalledWith(
                '* * * * *',
                expect.any(Function),
            );
            expect(mockContext.log.info).toHaveBeenCalledWith(
                { category: 'service_initialization' },
                'Engagement service initialized',
            );
        });
    });

    describe('trackMessage', () => {
        it('should add new user to buffer', () => {
            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');

            expect(engagementService.getBufferSize()).toBe(1);
        });

        it('should increment message count for existing user', () => {
            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');
            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');
            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');

            expect(engagementService.getBufferSize()).toBe(1);
        });

        it('should track different users separately', () => {
            engagementService.trackMessage('guild-1', 'user-1', 'User1');
            engagementService.trackMessage('guild-1', 'user-2', 'User2');

            expect(engagementService.getBufferSize()).toBe(2);
        });

        it('should track same user in different guilds separately', () => {
            engagementService.trackMessage('guild-1', 'user-1', 'User1');
            engagementService.trackMessage('guild-2', 'user-1', 'User1');

            expect(engagementService.getBufferSize()).toBe(2);
        });
    });

    describe('trackCommand', () => {
        it('should add new user to buffer', () => {
            engagementService.trackCommand('guild-1', 'user-1', 'TestUser');

            expect(engagementService.getBufferSize()).toBe(1);
        });

        it('should increment command count for existing user', () => {
            engagementService.trackCommand('guild-1', 'user-1', 'TestUser');
            engagementService.trackCommand('guild-1', 'user-1', 'TestUser');

            expect(engagementService.getBufferSize()).toBe(1);
        });

        it('should track both messages and commands for same user', () => {
            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');
            engagementService.trackCommand('guild-1', 'user-1', 'TestUser');

            expect(engagementService.getBufferSize()).toBe(1);
        });
    });

    describe('flushStats', () => {
        it('should do nothing when buffer is empty', async () => {
            await engagementService.flushStats();

            expect(mockUserStats.findOne).not.toHaveBeenCalled();
            expect(mockUserStats.create).not.toHaveBeenCalled();
        });

        it('should create new user stats when user not in database', async () => {
            mockUserStats.findOne.mockResolvedValue(null);
            mockUserStats.create.mockResolvedValue({});

            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');
            await engagementService.flushStats();

            expect(mockUserStats.create).toHaveBeenCalledWith(expect.objectContaining({
                guildId: 'guild-1',
                userId: 'user-1',
                username: 'TestUser',
                messageCount: 1,
                commandCount: 0,
            }));
            expect(engagementService.getBufferSize()).toBe(0);
        });

        it('should update existing user stats', async () => {
            const mockExisting = {
                getDataValue: jest.fn((key: string) => {
                    if (key === 'messageCount') return 10;
                    if (key === 'commandCount') return 5;
                    return null;
                }),
                update: jest.fn().mockResolvedValue({}),
            };
            mockUserStats.findOne.mockResolvedValue(mockExisting);

            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');
            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');
            await engagementService.flushStats();

            expect(mockExisting.update).toHaveBeenCalledWith(expect.objectContaining({
                username: 'TestUser',
                messageCount: 12, // 10 + 2
                commandCount: 5, // 5 + 0
            }));
            expect(engagementService.getBufferSize()).toBe(0);
        });

        it('should not clear buffer on error', async () => {
            mockUserStats.findOne.mockRejectedValue(new Error('Database error'));

            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');
            await engagementService.flushStats();

            expect(engagementService.getBufferSize()).toBe(1);
            expect(mockContext.log.error).toHaveBeenCalled();
        });

        it('should handle UserStats model not available', async () => {
            const contextWithoutUserStats = {
                ...mockContext,
                tables: {},
            } as any;
            const service = new EngagementService(contextWithoutUserStats);

            service.trackMessage('guild-1', 'user-1', 'TestUser');
            await service.flushStats();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                { category: 'engagement' },
                'UserStats model not available',
            );
        });
    });

    describe('getLeaderboard', () => {
        it('should return empty array when UserStats not available', async () => {
            const contextWithoutUserStats = {
                ...mockContext,
                tables: {},
            } as any;
            const service = new EngagementService(contextWithoutUserStats);

            const result = await service.getLeaderboard('guild-1');

            expect(result).toEqual([]);
        });

        it('should return sorted leaderboard', async () => {
            const mockStats = [
                {
                    getDataValue: jest.fn((key: string) => {
                        const data: Record<string, any> = {
                            userId: 'user-1',
                            username: 'TopUser',
                            messageCount: 100,
                            commandCount: 50,
                            lastActive: new Date(),
                        };
                        return data[key];
                    }),
                },
                {
                    getDataValue: jest.fn((key: string) => {
                        const data: Record<string, any> = {
                            userId: 'user-2',
                            username: 'SecondUser',
                            messageCount: 50,
                            commandCount: 25,
                            lastActive: new Date(),
                        };
                        return data[key];
                    }),
                },
            ];
            mockUserStats.findAll.mockResolvedValue(mockStats);

            const result = await engagementService.getLeaderboard('guild-1', 10);

            expect(mockUserStats.findAll).toHaveBeenCalledWith({
                where: { guildId: 'guild-1' },
                order: [['messageCount', 'DESC']],
                limit: 10,
            });
            expect(result).toHaveLength(2);
            expect(result[0].username).toBe('TopUser');
            expect(result[0].messageCount).toBe(100);
        });
    });

    describe('getUserStats', () => {
        it('should return null when UserStats not available', async () => {
            const contextWithoutUserStats = {
                ...mockContext,
                tables: {},
            } as any;
            const service = new EngagementService(contextWithoutUserStats);

            const result = await service.getUserStats('guild-1', 'user-1');

            expect(result).toBeNull();
        });

        it('should return null when user not found', async () => {
            mockUserStats.findOne.mockResolvedValue(null);

            const result = await engagementService.getUserStats('guild-1', 'user-1');

            expect(result).toBeNull();
        });

        it('should return user stats with rank', async () => {
            const mockStat = {
                getDataValue: jest.fn((key: string) => {
                    const data: Record<string, any> = {
                        userId: 'user-1',
                        username: 'TestUser',
                        messageCount: 50,
                        commandCount: 25,
                        lastActive: new Date(),
                        firstSeen: new Date('2024-01-01'),
                    };
                    return data[key];
                }),
            };
            mockUserStats.findOne.mockResolvedValue(mockStat);
            mockUserStats.count.mockResolvedValue(5); // 5 users have more messages

            const result = await engagementService.getUserStats('guild-1', 'user-1');

            expect(result).not.toBeNull();
            expect(result!.rank).toBe(6); // 5 + 1
            expect(result!.username).toBe('TestUser');
            expect(result!.messageCount).toBe(50);
        });

        it('should handle missing firstSeen with fallback', async () => {
            const mockStat = {
                getDataValue: jest.fn((key: string) => {
                    const data: Record<string, any> = {
                        userId: 'user-1',
                        username: 'TestUser',
                        messageCount: 50,
                        commandCount: 25,
                        lastActive: new Date(),
                        firstSeen: null, // Missing
                    };
                    return data[key];
                }),
            };
            mockUserStats.findOne.mockResolvedValue(mockStat);
            mockUserStats.count.mockResolvedValue(0);

            const result = await engagementService.getUserStats('guild-1', 'user-1');

            expect(result).not.toBeNull();
            expect(result!.firstSeen).toBeInstanceOf(Date);
        });
    });

    describe('getBufferSize', () => {
        it('should return 0 initially', () => {
            expect(engagementService.getBufferSize()).toBe(0);
        });

        it('should return correct count after tracking', () => {
            engagementService.trackMessage('guild-1', 'user-1', 'User1');
            engagementService.trackMessage('guild-1', 'user-2', 'User2');
            engagementService.trackMessage('guild-2', 'user-1', 'User1');

            expect(engagementService.getBufferSize()).toBe(3);
        });
    });

    describe('shutdown', () => {
        it('should stop scheduler and flush stats', async () => {
            const cron = jest.requireMock('node-cron');
            const mockTask = { stop: jest.fn() };
            cron.schedule.mockReturnValue(mockTask);

            engagementService.initialize();
            engagementService.trackMessage('guild-1', 'user-1', 'TestUser');

            mockUserStats.findOne.mockResolvedValue(null);
            mockUserStats.create.mockResolvedValue({});

            await engagementService.shutdown();

            expect(mockTask.stop).toHaveBeenCalled();
            expect(mockUserStats.create).toHaveBeenCalled();
            expect(mockContext.log.info).toHaveBeenCalledWith(
                { category: 'engagement' },
                'Shutting down engagement service',
            );
        });

        it('should handle shutdown without initialization', async () => {
            // Don't call initialize
            await engagementService.shutdown();

            expect(mockContext.log.info).toHaveBeenCalledWith(
                { category: 'engagement' },
                'Shutting down engagement service',
            );
        });
    });
});
