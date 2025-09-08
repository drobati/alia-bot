// Mock external dependencies
jest.mock('@polygon.io/client-js', () => ({
    restClient: jest.fn()
}), { virtual: true });

jest.mock('../utils/polygon-service');

// Basic structure test for stock command
import stockCommand from './stock';

describe('Stock Command', () => {
    describe('command structure', () => {
        it('should have correct command name and description', () => {
            expect(stockCommand.data.name).toBe('stock');
            expect(stockCommand.data.description).toBe('Stock market commands');
        });

        it('should have execute function', () => {
            expect(typeof stockCommand.execute).toBe('function');
        });
    });
});