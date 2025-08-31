import { createLogger, BotLogger } from './logger';

// Mock Sentry
jest.mock('../lib/sentry', () => ({
    Sentry: {
        logger: {
            debug: jest.fn(),
            info: jest.fn(),
            warn: jest.fn(),
            error: jest.fn(),
            fatal: jest.fn(),
        },
        setTags: jest.fn(),
        setExtra: jest.fn(),
        setUser: jest.fn(),
        captureException: jest.fn(),
        captureMessage: jest.fn(),
        addBreadcrumb: jest.fn(),
    },
}));

// Mock config
jest.mock('config', () => ({
    get: jest.fn().mockReturnValue('info'),
}));

describe('Logger Utils', () => {
    beforeEach(() => {
        process.env.SENTRY_DSN = 'https://test@sentry.io/123';
    });

    afterEach(() => {
        delete process.env.SENTRY_DSN;
    });

    describe('createLogger', () => {
        it('should create a bunyan logger', () => {
            const logger = createLogger('test-logger');
            expect(logger).toBeDefined();
        });

        it('should create logger with additional streams', () => {
            const additionalStream = {
                level: 'debug' as any,
                stream: process.stderr,
            };
            const logger = createLogger('test-with-additional', [additionalStream]);
            expect(logger).toBeDefined();
        });

        it('should handle production environment', () => {
            const originalEnv = process.env.NODE_ENV;
            process.env.NODE_ENV = 'production';
            
            const logger = createLogger('prod-logger');
            expect(logger).toBeDefined();
            
            process.env.NODE_ENV = originalEnv;
        });
    });

    describe('BotLogger', () => {
        let botLogger: BotLogger;

        beforeEach(() => {
            botLogger = new BotLogger('test-bot');
        });

        it('should expose logging methods', () => {
            expect(typeof botLogger.trace).toBe('function');
            expect(typeof botLogger.debug).toBe('function');
            expect(typeof botLogger.info).toBe('function');
            expect(typeof botLogger.warn).toBe('function');
            expect(typeof botLogger.error).toBe('function');
            expect(typeof botLogger.fatal).toBe('function');
        });

        it('should handle basic logging', () => {
            expect(() => {
                botLogger.info('test message');
                botLogger.warn('test warning');
                botLogger.error('test error');
            }).not.toThrow();
        });

        it('should log command execution', () => {
            expect(() => {
                botLogger.logCommand({
                    command: 'test-command',
                    userId: 'user123',
                    success: true,
                });
            }).not.toThrow();
        });

        it('should log failed command execution', () => {
            expect(() => {
                botLogger.logCommand({
                    command: 'failed-command',
                    userId: 'user123',
                    success: false,
                    error: new Error('Command failed'),
                });
            }).not.toThrow();
        });

        it('should log Discord events', () => {
            expect(() => {
                botLogger.logDiscordEvent({
                    event: 'messageCreate',
                    userId: 'user123',
                });
            }).not.toThrow();
        });

        it('should log API calls', () => {
            expect(() => {
                botLogger.logApiCall({
                    service: 'discord',
                    endpoint: '/test',
                    method: 'GET',
                    status: 200,
                    duration: 100,
                });
            }).not.toThrow();
        });

        it('should log database operations', () => {
            expect(() => {
                botLogger.logDatabaseOperation({
                    operation: 'SELECT',
                    table: 'users',
                });
            }).not.toThrow();
        });

        it('should create child logger', () => {
            const childLogger = botLogger.child({ requestId: 'req123' });
            expect(childLogger).toBeInstanceOf(BotLogger);
        });
    });
});