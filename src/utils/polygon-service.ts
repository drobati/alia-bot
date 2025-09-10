import { polygonClient } from 'polygon.io';
import { BotLogger } from './logger';

// Types for Polygon.io API responses
export interface StockQuote {
    symbol: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: number;
    isMarketOpen?: boolean;
}

export interface PolygonPreviousDayResponse {
    ticker: string;
    queryCount: number;
    resultsCount: number;
    adjusted: boolean;
    results: Array<{
        T: string; // ticker
        v: number; // volume
        vw: number; // volume weighted average price
        o: number; // open
        c: number; // close
        h: number; // high
        l: number; // low
        t: number; // timestamp
        n: number; // number of transactions
    }>;
    status: string;
    request_id: string;
}

// Rate limiting implementation
class RateLimiter {
    private requests: number[] = [];
    private maxRequests: number;
    private timeWindow: number; // in milliseconds
    private logger: BotLogger;

    constructor(maxRequests: number = 5, timeWindowMinutes: number = 1, logger: BotLogger) {
        this.maxRequests = maxRequests;
        this.timeWindow = timeWindowMinutes * 60 * 1000; // convert to milliseconds
        this.logger = logger;
    }

    async waitForSlot(): Promise<void> {
        const now = Date.now();

        // Remove old requests outside the time window
        this.requests = this.requests.filter(time => now - time < this.timeWindow);

        if (this.requests.length >= this.maxRequests) {
            const oldestRequest = Math.min(...this.requests);
            const waitTime = this.timeWindow - (now - oldestRequest) + 100; // Add 100ms buffer

            this.logger.info(`Rate limit reached, waiting ${waitTime}ms before next API call`);
            await new Promise(resolve => setTimeout(resolve, waitTime));

            // Recursively check again after waiting
            return this.waitForSlot();
        }

        this.requests.push(now);
    }

    getRemainingRequests(): number {
        const now = Date.now();
        this.requests = this.requests.filter(time => now - time < this.timeWindow);
        return Math.max(0, this.maxRequests - this.requests.length);
    }
}

export class PolygonService {
    private client: any;
    private rateLimiter: RateLimiter;
    private logger: BotLogger;
    private cache: Map<string, { data: StockQuote; timestamp: number }> = new Map();
    private cacheTimeoutMs: number = 5 * 60 * 1000; // 5 minutes cache

    constructor(logger: BotLogger) {
        const apiKey = process.env.POLYGON_API_KEY;

        if (!apiKey) {
            throw new Error('POLYGON_API_KEY environment variable is required');
        }

        this.client = polygonClient(apiKey);
        this.rateLimiter = new RateLimiter(5, 1, logger); // 5 requests per minute
        this.logger = logger;

        logger.info('PolygonService initialized with rate limiting');
    }

    /**
     * Get current stock quote with caching and rate limiting
     */
    async getStockQuote(symbol: string): Promise<StockQuote | null> {
        const normalizedSymbol = symbol.toUpperCase();

        // Check cache first
        const cached = this.getCachedQuote(normalizedSymbol);
        if (cached) {
            this.logger.info(`Stock quote cache hit for ${normalizedSymbol}`);
            return cached;
        }

        // Return mock data for testing when using placeholder API key
        const apiKey = process.env.POLYGON_API_KEY;
        if (apiKey === 'placeholder-key-for-testing') {
            return this.getMockStockData(normalizedSymbol);
        }

        try {
            // Wait for rate limit slot
            await this.rateLimiter.waitForSlot();

            this.logger.info(`Fetching stock quote for ${normalizedSymbol} from Polygon.io API`);

            // Get previous day's data (most reliable endpoint for free tier)
            const response = await this.client.rest.stocks.previousClose(normalizedSymbol) as
                PolygonPreviousDayResponse;

            if (!response.results || response.results.length === 0) {
                this.logger.warn(`No stock data found for symbol: ${normalizedSymbol}`);
                return null;
            }

            const result = response.results[0];

            // Calculate change from previous day
            const change = result.c - result.o;
            const changePercent = result.o !== 0 ? (change / result.o) * 100 : 0;

            const stockQuote: StockQuote = {
                symbol: normalizedSymbol,
                price: result.c,
                change: change,
                changePercent: changePercent,
                volume: result.v,
                high: result.h,
                low: result.l,
                open: result.o,
                previousClose: result.o, // For previous day data, open is the previous close
                timestamp: result.t,
                isMarketOpen: this.isMarketOpen(), // Simple market hours check
            };

            // Cache the result
            this.cache.set(normalizedSymbol, {
                data: stockQuote,
                timestamp: Date.now(),
            });

            this.logger.info(`Successfully fetched stock quote for ${normalizedSymbol}: $${result.c}`);
            return stockQuote;

        } catch (error) {
            this.logger.error('Error fetching stock quote from Polygon.io', {
                symbol: normalizedSymbol,
                error: error instanceof Error ? error.message : 'Unknown error',
                remainingRequests: this.rateLimiter.getRemainingRequests(),
            });
            return null;
        }
    }

    /**
     * Check if cached data is still valid
     */
    private getCachedQuote(symbol: string): StockQuote | null {
        const cached = this.cache.get(symbol);

        if (!cached) {
            return null;
        }

        const age = Date.now() - cached.timestamp;
        if (age > this.cacheTimeoutMs) {
            this.cache.delete(symbol);
            return null;
        }

        return cached.data;
    }

    /**
     * Simple market hours check (US market: 9:30 AM - 4:00 PM ET)
     * Note: This is a simplified check and doesn't account for holidays
     */
    private isMarketOpen(): boolean {
        const now = new Date();
        const et = new Date(now.toLocaleString("en-US", { timeZone: "America/New_York" }));

        const day = et.getDay(); // 0 = Sunday, 6 = Saturday
        if (day === 0 || day === 6) {
            return false; // Weekend
        }

        const hour = et.getHours();
        const minute = et.getMinutes();
        const timeInMinutes = hour * 60 + minute;

        const marketOpen = 9 * 60 + 30; // 9:30 AM
        const marketClose = 16 * 60; // 4:00 PM

        return timeInMinutes >= marketOpen && timeInMinutes < marketClose;
    }

    /**
     * Get rate limiting status
     */
    getRateLimitStatus(): { remaining: number; resetTime?: Date } {
        return {
            remaining: this.rateLimiter.getRemainingRequests(),
        };
    }

    /**
     * Clear cache (useful for testing)
     */
    clearCache(): void {
        this.cache.clear();
        this.logger.info('Stock quote cache cleared');
    }

    /**
     * Get cache statistics
     */
    getCacheStats(): { size: number; entries: string[] } {
        return {
            size: this.cache.size,
            entries: Array.from(this.cache.keys()),
        };
    }

    /**
     * Generate mock stock data for testing purposes
     */
    private getMockStockData(symbol: string): StockQuote {
        this.logger.info(`Returning mock data for ${symbol} (using placeholder API key)`);

        // Mock data for common symbols
        const mockPrices: { [key: string]: number } = {
            'AAPL': 175.50,
            'MSFT': 415.25,
            'GOOGL': 2850.75,
            'TSLA': 225.30,
            'AMZN': 3420.85,
            'NVDA': 875.40,
            'META': 298.65,
            'NFLX': 450.20,
        };

        const basePrice = mockPrices[symbol] || 100.00;
        const change = (Math.random() - 0.5) * 10; // Random change between -5 and +5
        const changePercent = (change / basePrice) * 100;
        const volume = Math.floor(Math.random() * 50000000) + 1000000; // Random volume

        const mockData: StockQuote = {
            symbol,
            price: basePrice + change,
            change: change,
            changePercent: changePercent,
            volume: volume,
            high: basePrice + Math.abs(change) + Math.random() * 5,
            low: basePrice - Math.abs(change) - Math.random() * 5,
            open: basePrice + (Math.random() - 0.5) * 2,
            previousClose: basePrice,
            timestamp: Date.now(),
            isMarketOpen: this.isMarketOpen(),
        };

        // Cache the mock data
        this.cache.set(symbol, {
            data: mockData,
            timestamp: Date.now(),
        });

        return mockData;
    }
}