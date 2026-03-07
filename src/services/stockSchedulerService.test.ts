jest.mock('node-cron', () => ({
    schedule: jest.fn().mockReturnValue({ stop: jest.fn() }),
}));

jest.mock('../utils/polygon-service', () => ({
    PolygonService: jest.fn().mockImplementation(() => ({
        getStockQuote: jest.fn(),
        getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
    })),
}));

import * as cron from 'node-cron';
import { StockSchedulerService } from './stockSchedulerService';
import { PolygonService } from '../utils/polygon-service';

const MockedPolygonService = PolygonService as jest.MockedClass<typeof PolygonService>;

function createMockContext() {
    return {
        log: {
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            debug: jest.fn(),
        },
        tables: {
            StockTracking: {
                count: jest.fn().mockResolvedValue(0),
                findAll: jest.fn().mockResolvedValue([]),
                findOne: jest.fn().mockResolvedValue(null),
                update: jest.fn().mockResolvedValue([1]),
            },
        },
    } as any;
}

function createMockClient() {
    return {
        channels: {
            cache: new Map(),
        },
    } as any;
}

describe('StockSchedulerService', () => {
    let service: StockSchedulerService;
    let mockContext: any;
    let mockClient: any;

    beforeEach(() => {
        jest.clearAllMocks();
        mockContext = createMockContext();
        mockClient = createMockClient();
        service = new StockSchedulerService(mockClient, mockContext);
    });

    describe('initialize', () => {
        it('should skip cron jobs when no active trackings exist', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(0);

            await service.initialize();

            expect(cron.schedule).not.toHaveBeenCalled();
            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'stock_scheduler' }),
                expect.stringContaining('No active stock trackings'),
            );
        });

        it('should start cron jobs when active trackings exist', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(3);

            await service.initialize();

            // 3 cron jobs: market open, market close, big swing
            expect(cron.schedule).toHaveBeenCalledTimes(3);
            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'stock_scheduler', activeTrackings: 3 }),
                expect.stringContaining('initialized'),
            );
        });

        it('should handle initialization errors gracefully', async () => {
            mockContext.tables.StockTracking.count.mockRejectedValue(new Error('DB error'));

            await service.initialize();

            expect(mockContext.log.error).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'stock_scheduler' }),
                expect.stringContaining('Failed to initialize'),
            );
        });
    });

    describe('startCronJobs', () => {
        it('should not start cron jobs twice', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);

            await service.initialize();
            service.startCronJobs(); // Call again

            // Should still only be 3
            expect(cron.schedule).toHaveBeenCalledTimes(3);
        });

        it('should schedule with America/New_York timezone', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);

            await service.initialize();

            const calls = (cron.schedule as jest.Mock).mock.calls;
            for (const call of calls) {
                expect(call[2]).toEqual(
                    expect.objectContaining({ timezone: 'America/New_York' }),
                );
            }
        });

        it('should schedule market open at 9:30 AM', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);

            await service.initialize();

            const calls = (cron.schedule as jest.Mock).mock.calls;
            expect(calls[0][0]).toBe('30 9 * * 1-5');
        });

        it('should schedule market close at 4:01 PM', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);

            await service.initialize();

            const calls = (cron.schedule as jest.Mock).mock.calls;
            expect(calls[1][0]).toBe('1 16 * * 1-5');
        });

        it('should schedule swing checks every 15 min during market hours', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);

            await service.initialize();

            const calls = (cron.schedule as jest.Mock).mock.calls;
            expect(calls[2][0]).toBe('*/15 9-16 * * 1-5');
        });
    });

    describe('sendMarketNotifications (via cron callback)', () => {
        it('should skip when no trackings for feature', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            mockContext.tables.StockTracking.findAll.mockResolvedValue([]);

            await service.initialize();

            // Trigger the market open callback
            const openCallback = (cron.schedule as jest.Mock).mock.calls[0][1];
            await openCallback();

            // No channel.send should be called
            expect(mockContext.log.error).not.toHaveBeenCalled();
        });

        it('should send notification to tracked channel', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            mockContext.tables.StockTracking.findAll.mockResolvedValue([
                { channel_id: 'ch1', guild_id: 'g1', ticker: 'AAPL', feature: 'market_open' },
            ]);

            const mockSend = jest.fn().mockResolvedValue(true);
            const mockChannel = { isTextBased: () => true, send: mockSend };
            mockClient.channels.cache.set('ch1', mockChannel);

            const mockQuote = {
                symbol: 'AAPL',
                price: 175.5,
                change: 2.5,
                changePercent: 1.44,
                volume: 50000000,
                high: 178,
                low: 173,
                open: 173,
                previousClose: 173,
                timestamp: Date.now(),
            };

            MockedPolygonService.mockImplementation(() => ({
                getStockQuote: jest.fn().mockResolvedValue(mockQuote),
                getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
            }) as any);

            await service.initialize();

            const openCallback = (cron.schedule as jest.Mock).mock.calls[0][1];
            await openCallback();

            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should handle missing channels gracefully', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            mockContext.tables.StockTracking.findAll.mockResolvedValue([
                { channel_id: 'missing', guild_id: 'g1', ticker: 'AAPL', feature: 'market_open' },
            ]);

            MockedPolygonService.mockImplementation(() => ({
                getStockQuote: jest.fn().mockResolvedValue({
                    symbol: 'AAPL', price: 175, change: 1,
                    changePercent: 0.5, volume: 1000000,
                    high: 176, low: 174, open: 174,
                    previousClose: 174, timestamp: Date.now(),
                }),
                getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
            }) as any);

            await service.initialize();

            const openCallback = (cron.schedule as jest.Mock).mock.calls[0][1];
            await openCallback();

            // Should not throw, just skip the missing channel
        });

        it('should group multiple tickers per channel', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(2);
            mockContext.tables.StockTracking.findAll.mockResolvedValue([
                { channel_id: 'ch1', guild_id: 'g1', ticker: 'AAPL', feature: 'market_open' },
                { channel_id: 'ch1', guild_id: 'g1', ticker: 'TSLA', feature: 'market_open' },
            ]);

            const mockSend = jest.fn().mockResolvedValue(true);
            const mockChannel = { isTextBased: () => true, send: mockSend };
            mockClient.channels.cache.set('ch1', mockChannel);

            const mockGetStockQuote = jest.fn()
                .mockResolvedValueOnce({
                    symbol: 'AAPL', price: 175, change: 1,
                    changePercent: 0.5, volume: 1000000,
                    high: 176, low: 174, open: 174,
                    previousClose: 174, timestamp: Date.now(),
                })
                .mockResolvedValueOnce({
                    symbol: 'TSLA', price: 225, change: -3,
                    changePercent: -1.3, volume: 2000000,
                    high: 228, low: 223, open: 228,
                    previousClose: 228, timestamp: Date.now(),
                });

            MockedPolygonService.mockImplementation(() => ({
                getStockQuote: mockGetStockQuote,
                getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
            }) as any);

            await service.initialize();

            const openCallback = (cron.schedule as jest.Mock).mock.calls[0][1];
            await openCallback();

            // Should send one message with both tickers
            expect(mockSend).toHaveBeenCalledTimes(1);
        });
    });

    describe('checkBigSwings (via cron callback)', () => {
        it('should skip when no big_swing trackings', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            mockContext.tables.StockTracking.findAll
                .mockResolvedValueOnce([]) // market open findAll
                .mockResolvedValue([]); // big_swing findAll

            await service.initialize();

            const swingCallback = (cron.schedule as jest.Mock).mock.calls[2][1];
            await swingCallback();

            // Should not error
            expect(mockContext.log.error).not.toHaveBeenCalled();
        });

        it('should send alert when swing exceeds threshold', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            mockContext.tables.StockTracking.findAll.mockResolvedValue([
                {
                    channel_id: 'ch1', guild_id: 'g1', ticker: 'NVDA',
                    feature: 'big_swing', threshold: 5, last_notified_at: null,
                },
            ]);
            mockContext.tables.StockTracking.findOne.mockResolvedValue({
                last_notified_at: null,
            });

            const mockSend = jest.fn().mockResolvedValue(true);
            const mockChannel = { isTextBased: () => true, send: mockSend };
            mockClient.channels.cache.set('ch1', mockChannel);

            MockedPolygonService.mockImplementation(() => ({
                getStockQuote: jest.fn().mockResolvedValue({
                    symbol: 'NVDA', price: 900, change: 50,
                    changePercent: 5.88, volume: 80000000,
                    high: 910, low: 850, open: 850,
                    previousClose: 850, timestamp: Date.now(),
                }),
                getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
            }) as any);

            await service.initialize();

            const swingCallback = (cron.schedule as jest.Mock).mock.calls[2][1];
            await swingCallback();

            expect(mockSend).toHaveBeenCalledWith(
                expect.objectContaining({ embeds: expect.any(Array) }),
            );
        });

        it('should respect 1-hour cooldown', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            mockContext.tables.StockTracking.findAll.mockResolvedValue([
                {
                    channel_id: 'ch1', guild_id: 'g1', ticker: 'NVDA',
                    feature: 'big_swing', threshold: 5,
                },
            ]);
            // Last notified 30 minutes ago (within cooldown)
            mockContext.tables.StockTracking.findOne.mockResolvedValue({
                last_notified_at: new Date(Date.now() - 30 * 60 * 1000),
            });

            const mockSend = jest.fn().mockResolvedValue(true);
            const mockChannel = { isTextBased: () => true, send: mockSend };
            mockClient.channels.cache.set('ch1', mockChannel);

            MockedPolygonService.mockImplementation(() => ({
                getStockQuote: jest.fn().mockResolvedValue({
                    symbol: 'NVDA', price: 900, change: 50,
                    changePercent: 5.88, volume: 80000000,
                    high: 910, low: 850, open: 850,
                    previousClose: 850, timestamp: Date.now(),
                }),
                getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
            }) as any);

            await service.initialize();

            const swingCallback = (cron.schedule as jest.Mock).mock.calls[2][1];
            await swingCallback();

            // Should NOT send because of cooldown
            expect(mockSend).not.toHaveBeenCalled();
        });

        it('should not alert when change is below threshold', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            mockContext.tables.StockTracking.findAll.mockResolvedValue([
                {
                    channel_id: 'ch1', guild_id: 'g1', ticker: 'AAPL',
                    feature: 'big_swing', threshold: 5,
                },
            ]);

            const mockSend = jest.fn().mockResolvedValue(true);
            const mockChannel = { isTextBased: () => true, send: mockSend };
            mockClient.channels.cache.set('ch1', mockChannel);

            MockedPolygonService.mockImplementation(() => ({
                getStockQuote: jest.fn().mockResolvedValue({
                    symbol: 'AAPL', price: 176, change: 1,
                    changePercent: 0.57, volume: 50000000,
                    high: 177, low: 175, open: 175,
                    previousClose: 175, timestamp: Date.now(),
                }),
                getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
            }) as any);

            await service.initialize();

            const swingCallback = (cron.schedule as jest.Mock).mock.calls[2][1];
            await swingCallback();

            expect(mockSend).not.toHaveBeenCalled();
        });
    });

    describe('shutdown', () => {
        it('should stop all cron tasks', async () => {
            mockContext.tables.StockTracking.count.mockResolvedValue(1);
            await service.initialize();

            service.shutdown();

            const mockTasks = (cron.schedule as jest.Mock).mock.results;
            for (const result of mockTasks) {
                expect(result.value.stop).toHaveBeenCalled();
            }
        });

        it('should log shutdown', () => {
            service.shutdown();

            expect(mockContext.log.info).toHaveBeenCalledWith(
                expect.objectContaining({ category: 'stock_scheduler' }),
                expect.stringContaining('shut down'),
            );
        });
    });
});
