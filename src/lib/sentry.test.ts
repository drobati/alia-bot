import { initializeSentry, captureOwnerIdDebug, setSentryUserContext } from './sentry';

// Mock Sentry
jest.mock('@sentry/node', () => ({
    init: jest.fn(),
    addBreadcrumb: jest.fn(),
    captureMessage: jest.fn(),
    setUser: jest.fn(),
    consoleLoggingIntegration: jest.fn().mockReturnValue({}),
}));

jest.mock('@sentry/profiling-node', () => ({
    nodeProfilingIntegration: jest.fn().mockReturnValue({}),
}));

// Mock config
jest.mock('config', () => ({
    get: jest.fn().mockReturnValue('test-owner-id'),
}));

import * as Sentry from '@sentry/node';

const mockSentry = Sentry as jest.Mocked<typeof Sentry>;

describe('Sentry Integration', () => {
    const originalEnv = process.env;

    beforeEach(() => {
        jest.clearAllMocks();
        process.env = { ...originalEnv };
    });

    afterEach(() => {
        process.env = originalEnv;
    });

    describe('initializeSentry', () => {
        it('should initialize Sentry with DSN', () => {
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';

            initializeSentry();

            expect(mockSentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    dsn: 'https://test@sentry.io/123',
                    enableLogs: true,
                }),
            );
        });

        it('should warn when DSN is not set', () => {
            const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
            delete process.env.SENTRY_DSN;

            initializeSentry();

            expect(consoleSpy).toHaveBeenCalledWith(
                'SENTRY_DSN environment variable not set. Sentry logging disabled.',
            );
            expect(mockSentry.init).not.toHaveBeenCalled();

            consoleSpy.mockRestore();
        });

        it('should use production settings', () => {
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';
            process.env.NODE_ENV = 'production';

            initializeSentry();

            expect(mockSentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    environment: 'production',
                    debug: false,
                }),
            );
        });

        it('should use development settings', () => {
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';
            process.env.NODE_ENV = 'development';

            initializeSentry();

            expect(mockSentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    environment: 'development',
                    debug: true,
                }),
            );
        });

        it('should use VERSION for release', () => {
            process.env.SENTRY_DSN = 'https://test@sentry.io/123';
            process.env.VERSION = '2.0.0';

            initializeSentry();

            expect(mockSentry.init).toHaveBeenCalledWith(
                expect.objectContaining({
                    release: '2.0.0',
                }),
            );
        });
    });

    describe('captureOwnerIdDebug', () => {
        it('should add breadcrumb with debug info', () => {
            const debugData = {
                userId: 'user123',
                configuredOwnerId: 'owner456',
                isOwner: false,
                event: 'test',
            };

            captureOwnerIdDebug(debugData);

            expect(mockSentry.addBreadcrumb).toHaveBeenCalledWith(
                expect.objectContaining({
                    message: 'Owner ID Debug: test',
                    category: 'auth',
                    level: 'info',
                }),
            );
        });

        it('should capture message on permission check mismatch', () => {
            const debugData = {
                userId: 'user123',
                configuredOwnerId: 'owner456',
                isOwner: false,
                event: 'permission_check',
            };

            captureOwnerIdDebug(debugData);

            expect(mockSentry.captureMessage).toHaveBeenCalledWith(
                'Owner ID mismatch detected',
                'warning',
            );
        });

        it('should not capture message for non-permission-check events', () => {
            const debugData = {
                userId: 'user123',
                configuredOwnerId: 'owner456',
                isOwner: false,
                event: 'login',
            };

            captureOwnerIdDebug(debugData);

            expect(mockSentry.captureMessage).not.toHaveBeenCalled();
        });
    });

    describe('setSentryUserContext', () => {
        it('should set user context', () => {
            setSentryUserContext('user123', 'testuser', true);

            expect(mockSentry.setUser).toHaveBeenCalledWith({
                id: 'user123',
                username: 'testuser',
                isOwner: true,
            });
        });

        it('should handle minimal parameters', () => {
            setSentryUserContext('user123');

            expect(mockSentry.setUser).toHaveBeenCalledWith({
                id: 'user123',
                username: undefined,
                isOwner: undefined,
            });
        });
    });
});