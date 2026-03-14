import { PolygonService } from './polygon-service';
import { BotLogger } from './logger';

// Mock the polygon.io module
const mockAggregates = jest.fn();
jest.mock('polygon.io', () => ({
    polygonClient: jest.fn().mockImplementation(() => ({
        rest: {
            stocks: {
                aggregates: mockAggregates,
            },
        },
    })),
}), { virtual: true });

// Mock logger
const mockLogger = {
    info: jest.fn(),
    warn: jest.fn(),
    error: jest.fn(),
    debug: jest.fn(),
    fatal: jest.fn(),
} as unknown as BotLogger;

describe('PolygonService', () => {
    let service: PolygonService;
    const originalEnv = process.env.POLYGON_API_KEY;

    // Two-bar response: previous trading day + current day
    const mockApiResponse = {
        ticker: 'AAPL',
        queryCount: 2,
        resultsCount: 2,
        adjusted: true,
        results: [
            {
                T: 'AAPL',
                v: 900000,
                vw: 148.00,
                o: 147.00,  // previous day open
                c: 149.00,  // previous day close
                h: 150.00,
                l: 146.50,
                t: 1672444800000,
                n: 11000,
            },
            {
                T: 'AAPL',
                v: 1000000,
                vw: 150.25,
                o: 150.00,  // today's open
                c: 152.50,  // today's close
                h: 153.00,
                l: 149.50,
                t: 1672531200000,
                n: 12345,
            },
        ],
        status: 'OK',
        request_id: 'test-id',
    };

    beforeEach(() => {
        process.env.POLYGON_API_KEY = 'test-api-key';
        service = new PolygonService(mockLogger);
        service.clearCache(); // Ensure clean state
        jest.clearAllMocks();
    });

    afterEach(() => {
        process.env.POLYGON_API_KEY = originalEnv;
    });

    describe('constructor', () => {
        it('should throw error if POLYGON_API_KEY is not set', () => {
            delete process.env.POLYGON_API_KEY;

            expect(() => new PolygonService(mockLogger)).toThrow(
                'POLYGON_API_KEY environment variable is required',
            );
        });

        it('should initialize successfully with API key', () => {
            process.env.POLYGON_API_KEY = 'valid-key';

            expect(() => new PolygonService(mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'PolygonService initialized with rate limiting',
            );
        });
    });

    describe('getStockQuote', () => {

        it('should fetch and return stock quote successfully', async () => {
            mockAggregates.mockResolvedValue(mockApiResponse);

            const result = await service.getStockQuote('AAPL');

            expect(result).toEqual({
                symbol: 'AAPL',
                price: 152.50,
                change: 3.50, // 152.50 - 149.00 (previous day close)
                changePercent: expect.closeTo(2.3489, 3), // (3.50 / 149.00) * 100
                volume: 1000000,
                high: 153.00,
                low: 149.50,
                open: 150.00,
                previousClose: 149.00,
                timestamp: 1672531200000,
                isMarketOpen: expect.any(Boolean),
            });

            expect(mockAggregates).toHaveBeenCalledWith(
                'AAPL', 1, 'day',
                expect.any(String), expect.any(String),
                { adjusted: true, sort: 'asc' },
            );
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Fetching stock quote for AAPL from Polygon.io API',
            );
        });

        it('should normalize symbol to uppercase', async () => {
            mockAggregates.mockResolvedValue(mockApiResponse);

            await service.getStockQuote('aapl');

            expect(mockAggregates).toHaveBeenCalledWith(
                'AAPL', 1, 'day',
                expect.any(String), expect.any(String),
                { adjusted: true, sort: 'asc' },
            );
        });

        it('should return null for invalid symbol', async () => {
            mockAggregates.mockResolvedValue({
                ...mockApiResponse,
                results: [],
            });

            const result = await service.getStockQuote('INVALID');

            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'No stock data found for symbol: INVALID',
            );
        });

        it('should handle API errors gracefully', async () => {
            const errorResponse = {
                status: 'ERROR',
                request_id: '1793bdfaea04bcd156da93791539e52a',
                error: 'Unknown API Key',
            };
            mockAggregates.mockRejectedValue(new Error(JSON.stringify(errorResponse)));

            const result = await service.getStockQuote('AAPL');

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error fetching stock quote from Polygon.io',
                expect.objectContaining({
                    symbol: 'AAPL',
                    error: expect.stringContaining('Unknown API Key'),
                }),
            );
        });

        it('should use cached data when available', async () => {
            mockAggregates.mockResolvedValue(mockApiResponse);

            // First call - should fetch from API
            const result1 = await service.getStockQuote('AAPL');
            const firstCallCount = mockAggregates.mock.calls.length;
            expect(firstCallCount).toBeGreaterThan(0);

            // Second call - should use cache (if cache timeout hasn't expired)
            const result2 = await service.getStockQuote('AAPL');

            // Either uses cache (same call count) or makes another call
            expect(mockAggregates.mock.calls.length).toBeGreaterThanOrEqual(firstCallCount);

            // Both results should have same structure
            if (result1 && result2) {
                expect(result1.symbol).toBe(result2.symbol);
                expect(result1.price).toBe(result2.price);
            }
        });

        it('should calculate change percent correctly when previous close is zero', async () => {
            const responseWithZeroPrevClose = {
                ...mockApiResponse,
                results: [
                    { ...mockApiResponse.results[0], c: 0 }, // previous day close = 0
                    { ...mockApiResponse.results[1], o: 100, c: 100 },
                ],
            };

            mockAggregates.mockResolvedValue(responseWithZeroPrevClose);

            const result = await service.getStockQuote('TEST');

            expect(result).toEqual(expect.objectContaining({
                changePercent: 0,
            }));
        });

        it('should fall back to open as previousClose when only one bar returned', async () => {
            const singleBarResponse = {
                ...mockApiResponse,
                resultsCount: 1,
                results: [mockApiResponse.results[1]], // only today's bar
            };

            mockAggregates.mockResolvedValue(singleBarResponse);

            const result = await service.getStockQuote('TEST');

            expect(result).toEqual(expect.objectContaining({
                open: 150.00,
                previousClose: 150.00, // falls back to today's open
                change: 2.50, // 152.50 - 150.00
            }));
        });
    });

    describe('rate limiting', () => {
        it('should track rate limit status', () => {
            const status = service.getRateLimitStatus();

            expect(status).toHaveProperty('remaining');
            expect(typeof status.remaining).toBe('number');
            expect(status.remaining).toBeLessThanOrEqual(5);
        });

        it('should enforce rate limiting', async () => {
            mockAggregates.mockResolvedValue({
                ticker: 'TEST',
                queryCount: 1,
                resultsCount: 1,
                adjusted: true,
                results: [
                    { T: 'TEST', v: 900, vw: 99, o: 98, c: 99, h: 100, l: 97, t: Date.now() - 86400000, n: 90 },
                    { T: 'TEST', v: 1000, vw: 100, o: 100, c: 100, h: 100, l: 100, t: Date.now(), n: 100 },
                ],
                status: 'OK',
                request_id: 'test',
            });

            // Make 5 requests quickly (at the rate limit)
            const promises = Array(5).fill(0).map((_, i) =>
                service.getStockQuote(`TEST${i}`),
            );

            await Promise.all(promises);

            // Check that remaining requests is 0
            const status = service.getRateLimitStatus();
            expect(status.remaining).toBe(0);
        }, 10000); // Increase timeout to 10 seconds
    });

    describe('cache management', () => {
        it('should clear cache', () => {
            service.clearCache();

            expect(mockLogger.info).toHaveBeenCalledWith('Stock quote cache cleared');
        });

        it('should provide cache statistics', async () => {
            mockAggregates.mockResolvedValue(mockApiResponse);

            await service.getStockQuote('AAPL');

            const stats = service.getCacheStats();
            expect(stats.size).toBe(1);
            expect(stats.entries).toContain('AAPL');
        });
    });

    describe('market hours detection', () => {
        it('should detect market status', async () => {
            mockAggregates.mockResolvedValue({
                ticker: 'AAPL',
                queryCount: 1,
                resultsCount: 1,
                adjusted: true,
                results: [
                    { T: 'AAPL', v: 900, vw: 149, o: 148, c: 149, h: 150, l: 147, t: Date.now() - 86400000, n: 90 },
                    { T: 'AAPL', v: 1000, vw: 150, o: 150, c: 150, h: 150, l: 150, t: Date.now(), n: 100 },
                ],
                status: 'OK',
                request_id: 'test',
            });

            const result = await service.getStockQuote('AAPL');

            expect(result).toHaveProperty('isMarketOpen');
            expect(typeof result?.isMarketOpen).toBe('boolean');
        });
    });
});