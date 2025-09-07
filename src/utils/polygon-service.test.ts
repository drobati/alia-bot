import { PolygonService, StockQuote } from './polygon-service';
import { BotLogger } from './logger';

// Mock the @polygon.io/client-js module
const mockPreviousClose = jest.fn();
jest.mock('@polygon.io/client-js', () => ({
    restClient: jest.fn().mockImplementation(() => ({
        stocks: {
            previousClose: mockPreviousClose
        }
    }))
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
                'POLYGON_API_KEY environment variable is required'
            );
        });

        it('should initialize successfully with API key', () => {
            process.env.POLYGON_API_KEY = 'valid-key';
            
            expect(() => new PolygonService(mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'PolygonService initialized with rate limiting'
            );
        });
    });

    describe('getStockQuote', () => {
        const mockApiResponse = {
            ticker: 'AAPL',
            queryCount: 1,
            resultsCount: 1,
            adjusted: true,
            results: [{
                T: 'AAPL',
                v: 1000000, // volume
                vw: 150.25, // volume weighted average
                o: 150.00,  // open
                c: 152.50,  // close
                h: 153.00,  // high
                l: 149.50,  // low
                t: 1672531200000, // timestamp
                n: 12345    // number of transactions
            }],
            status: 'OK',
            request_id: 'test-id'
        };

        it('should fetch and return stock quote successfully', async () => {
            mockPreviousClose.mockResolvedValue(mockApiResponse);

            const result = await service.getStockQuote('AAPL');

            expect(result).toEqual({
                symbol: 'AAPL',
                price: 152.50,
                change: 2.50, // 152.50 - 150.00
                changePercent: 1.6666666666666667, // (2.50 / 150.00) * 100
                volume: 1000000,
                high: 153.00,
                low: 149.50,
                open: 150.00,
                previousClose: 150.00,
                timestamp: 1672531200000,
                isMarketOpen: expect.any(Boolean)
            });

            expect(mockPreviousClose).toHaveBeenCalledWith('AAPL');
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Fetching stock quote for AAPL from Polygon.io API'
            );
        });

        it('should normalize symbol to uppercase', async () => {
            mockPreviousClose.mockResolvedValue(mockApiResponse);

            await service.getStockQuote('aapl');

            expect(mockPreviousClose).toHaveBeenCalledWith('AAPL');
        });

        it('should return null for invalid symbol', async () => {
            mockPreviousClose.mockResolvedValue({
                ...mockApiResponse,
                results: []
            });

            const result = await service.getStockQuote('INVALID');

            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'No stock data found for symbol: INVALID'
            );
        });

        it('should handle API errors gracefully', async () => {
            mockPreviousClose.mockRejectedValue(new Error('API Error'));

            const result = await service.getStockQuote('AAPL');

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error fetching stock quote from Polygon.io',
                expect.objectContaining({
                    symbol: 'AAPL',
                    error: 'API Error'
                })
            );
        });

        it('should use cached data when available', async () => {
            mockPreviousClose.mockResolvedValue(mockApiResponse);

            // First call - should fetch from API
            const result1 = await service.getStockQuote('AAPL');
            expect(mockPreviousClose).toHaveBeenCalledTimes(1);

            // Second call - should use cache
            const result2 = await service.getStockQuote('AAPL');
            expect(mockPreviousClose).toHaveBeenCalledTimes(1); // Still only 1 call
            expect(result1).toEqual(result2);
            expect(mockLogger.info).toHaveBeenCalledWith('Stock quote cache hit for AAPL');
        });

        it('should calculate change percent correctly when open is zero', async () => {
            const responseWithZeroOpen = {
                ...mockApiResponse,
                results: [{
                    ...mockApiResponse.results[0],
                    o: 0,  // open price is 0
                    c: 100 // close price
                }]
            };
            
            mockPreviousClose.mockResolvedValue(responseWithZeroOpen);

            const result = await service.getStockQuote('TEST');

            expect(result?.changePercent).toBe(0);
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
            mockPreviousClose.mockResolvedValue({
                ticker: 'TEST',
                queryCount: 1,
                resultsCount: 1,
                adjusted: true,
                results: [{
                    T: 'TEST',
                    v: 1000,
                    vw: 100,
                    o: 100,
                    c: 100,
                    h: 100,
                    l: 100,
                    t: Date.now(),
                    n: 100
                }],
                status: 'OK',
                request_id: 'test'
            });

            // Make 5 requests quickly (at the rate limit)
            const promises = Array(5).fill(0).map((_, i) => 
                service.getStockQuote(`TEST${i}`)
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
            mockPreviousClose.mockResolvedValue({
                ticker: 'AAPL',
                queryCount: 1,
                resultsCount: 1,
                adjusted: true,
                results: [{
                    T: 'AAPL',
                    v: 1000,
                    vw: 150,
                    o: 150,
                    c: 150,
                    h: 150,
                    l: 150,
                    t: Date.now(),
                    n: 100
                }],
                status: 'OK',
                request_id: 'test'
            });

            await service.getStockQuote('AAPL');
            
            const stats = service.getCacheStats();
            expect(stats.size).toBe(1);
            expect(stats.entries).toContain('AAPL');
        });
    });

    describe('market hours detection', () => {
        it('should detect market status', async () => {
            mockPreviousClose.mockResolvedValue({
                ticker: 'AAPL',
                queryCount: 1,
                resultsCount: 1,
                adjusted: true,
                results: [{
                    T: 'AAPL',
                    v: 1000,
                    vw: 150,
                    o: 150,
                    c: 150,
                    h: 150,
                    l: 150,
                    t: Date.now(),
                    n: 100
                }],
                status: 'OK',
                request_id: 'test'
            });

            const result = await service.getStockQuote('AAPL');
            
            expect(result).toHaveProperty('isMarketOpen');
            expect(typeof result?.isMarketOpen).toBe('boolean');
        });
    });
});