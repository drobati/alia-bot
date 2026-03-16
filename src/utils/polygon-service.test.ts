import { PolygonService } from './polygon-service';
import { BotLogger } from './logger';

// Mock yahoo-finance2
const mockQuote = jest.fn();
jest.mock('yahoo-finance2', () => ({
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
        quote: mockQuote,
    })),
}));

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

    const mockYahooQuote = {
        symbol: 'AAPL',
        regularMarketPrice: 252.82,
        regularMarketOpen: 252.10,
        regularMarketPreviousClose: 250.12,
        regularMarketDayHigh: 253.88,
        regularMarketDayLow: 249.88,
        regularMarketVolume: 30091880,
        regularMarketChange: 2.70,
        regularMarketChangePercent: 1.08,
        regularMarketTime: new Date('2026-03-14T20:00:00Z'),
        marketState: 'REGULAR',
    };

    beforeEach(() => {
        service = new PolygonService(mockLogger);
        service.clearCache();
        jest.clearAllMocks();
    });

    describe('constructor', () => {
        it('should initialize successfully', () => {
            expect(() => new PolygonService(mockLogger)).not.toThrow();
            expect(mockLogger.info).toHaveBeenCalledWith(
                'PolygonService initialized with Yahoo Finance',
            );
        });
    });

    describe('getStockQuote', () => {
        it('should fetch and return stock quote successfully', async () => {
            mockQuote.mockResolvedValue(mockYahooQuote);

            const result = await service.getStockQuote('AAPL');

            expect(result).toEqual({
                symbol: 'AAPL',
                price: 252.82,
                change: 2.70,
                changePercent: 1.08,
                volume: 30091880,
                high: 253.88,
                low: 249.88,
                open: 252.10,
                previousClose: 250.12,
                timestamp: expect.any(Number),
                isMarketOpen: true,
            });

            expect(mockQuote).toHaveBeenCalledWith('AAPL');
            expect(mockLogger.info).toHaveBeenCalledWith(
                'Fetching stock quote for AAPL from Yahoo Finance',
            );
        });

        it('should normalize symbol to uppercase', async () => {
            mockQuote.mockResolvedValue(mockYahooQuote);

            await service.getStockQuote('aapl');

            expect(mockQuote).toHaveBeenCalledWith('AAPL');
        });

        it('should return null for invalid symbol', async () => {
            mockQuote.mockResolvedValue({ symbol: 'INVALID' });

            const result = await service.getStockQuote('INVALID');

            expect(result).toBeNull();
            expect(mockLogger.warn).toHaveBeenCalledWith(
                'No stock data found for symbol: INVALID',
            );
        });

        it('should handle API errors gracefully', async () => {
            mockQuote.mockRejectedValue(new Error('Not Found'));

            const result = await service.getStockQuote('AAPL');

            expect(result).toBeNull();
            expect(mockLogger.error).toHaveBeenCalledWith(
                'Error fetching stock quote from Yahoo Finance',
                expect.objectContaining({
                    symbol: 'AAPL',
                    error: 'Not Found',
                }),
            );
        });

        it('should use cached data when available', async () => {
            mockQuote.mockResolvedValue(mockYahooQuote);

            const result1 = await service.getStockQuote('AAPL');
            const firstCallCount = mockQuote.mock.calls.length;
            expect(firstCallCount).toBeGreaterThan(0);

            const result2 = await service.getStockQuote('AAPL');

            // Should use cache — no additional API call
            expect(mockQuote.mock.calls.length).toBe(firstCallCount);

            if (result1 && result2) {
                expect(result1.symbol).toBe(result2.symbol);
                expect(result1.price).toBe(result2.price);
            }
        });

        it('should detect market open from Yahoo marketState', async () => {
            mockQuote.mockResolvedValue({
                ...mockYahooQuote,
                marketState: 'REGULAR',
            });

            const result = await service.getStockQuote('AAPL');
            expect(result?.isMarketOpen).toBe(true);
        });

        it('should detect market closed from Yahoo marketState', async () => {
            mockQuote.mockResolvedValue({
                ...mockYahooQuote,
                marketState: 'POST',
            });

            const result = await service.getStockQuote('AAPL');
            expect(result?.isMarketOpen).toBe(false);
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
            mockQuote.mockResolvedValue(mockYahooQuote);

            const promises = Array(5).fill(0).map((_, i) =>
                service.getStockQuote(`TEST${i}`),
            );

            await Promise.all(promises);

            const status = service.getRateLimitStatus();
            expect(status.remaining).toBe(0);
        }, 10000);
    });

    describe('cache management', () => {
        it('should clear cache', () => {
            service.clearCache();

            expect(mockLogger.info).toHaveBeenCalledWith('Stock quote cache cleared');
        });

        it('should provide cache statistics', async () => {
            mockQuote.mockResolvedValue(mockYahooQuote);

            await service.getStockQuote('AAPL');

            const stats = service.getCacheStats();
            expect(stats.size).toBe(1);
            expect(stats.entries).toContain('AAPL');
        });
    });
});
