// Mock external dependencies
jest.mock('@polygon.io/client-js', () => ({
    restClient: jest.fn(),
}), { virtual: true });

jest.mock('../utils/polygon-service');

import stockCommand from './stock';
import { createContext, createInteraction } from '../utils/testHelpers';
import { PolygonService } from '../utils/polygon-service';

const MockedPolygonService = PolygonService as jest.MockedClass<typeof PolygonService>;

describe('Stock Command - Integration Tests', () => {
    let mockInteraction: any;
    let mockContext: any;
    let mockPolygonService: jest.Mocked<PolygonService>;

    beforeEach(() => {
        mockPolygonService = {
            getStockQuote: jest.fn(),
            getRateLimitStatus: jest.fn().mockReturnValue({ remaining: 5 }),
            clearCache: jest.fn(),
            getCacheStats: jest.fn(),
        } as any;

        MockedPolygonService.mockImplementation(() => mockPolygonService);

        mockInteraction = createInteraction();
        mockInteraction.isChatInputCommand = jest.fn().mockReturnValue(true);
        mockInteraction.options.getSubcommand = jest.fn().mockReturnValue('get');
        mockInteraction.options.getString = jest.fn();
        mockInteraction.options.getFocused = jest.fn();
        mockInteraction.deferReply = jest.fn().mockResolvedValue(true);
        mockInteraction.editReply = jest.fn().mockResolvedValue(true);
        mockInteraction.followUp = jest.fn().mockResolvedValue(true);
        mockInteraction.respond = jest.fn().mockResolvedValue(true);
        mockInteraction.user = { username: 'testuser' };

        mockContext = createContext();
        jest.clearAllMocks();
    });

    describe('command structure', () => {
        it('should have correct command name and description', () => {
            expect(stockCommand.data.name).toBe('stock');
            expect(stockCommand.data.description).toBe('Stock market commands');
        });

        it('should have execute and autocomplete functions', () => {
            expect(typeof stockCommand.execute).toBe('function');
            expect(typeof stockCommand.autocomplete).toBe('function');
        });

        it('should have get subcommand with autocomplete', () => {
            const commandData = stockCommand.data.toJSON();
            expect(commandData.options).toHaveLength(1);
            expect(commandData.options![0].name).toBe('get');
        });
    });

    describe('input validation', () => {
        it('should validate ticker format and reject invalid tickers', async () => {
            mockInteraction.options.getString.mockReturnValue('INVALID123');

            await stockCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Invalid ticker format'),
                ephemeral: true,
            });
        });

        it('should validate ticker format and reject empty ticker', async () => {
            mockInteraction.options.getString.mockReturnValue(null);

            await stockCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Please provide a ticker symbol'),
                ephemeral: true,
            });
        });

        it('should handle non-chat input commands', async () => {
            mockInteraction.isChatInputCommand.mockReturnValue(false);

            await stockCommand.execute(mockInteraction, mockContext);

            // Should return early without processing
            expect(mockInteraction.reply).not.toHaveBeenCalled();
        });

        it('should handle unknown subcommands', async () => {
            mockInteraction.options.getSubcommand.mockReturnValue('unknown');

            await stockCommand.execute(mockInteraction, mockContext);

            expect(mockInteraction.reply).toHaveBeenCalledWith({
                content: expect.stringContaining('Unknown subcommand'),
                ephemeral: true,
            });
        });
    });

    describe('autocomplete functionality', () => {
        it('should provide stock suggestions', async () => {
            mockInteraction.options.getFocused.mockReturnValue('AA');

            await stockCommand.autocomplete(mockInteraction);

            expect(mockInteraction.respond).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'AAPL - Apple Inc.',
                        value: 'AAPL',
                    }),
                ]),
            );
        });

        it('should filter suggestions based on company name', async () => {
            mockInteraction.options.getFocused.mockReturnValue('apple');

            await stockCommand.autocomplete(mockInteraction);

            expect(mockInteraction.respond).toHaveBeenCalledWith(
                expect.arrayContaining([
                    expect.objectContaining({
                        name: 'AAPL - Apple Inc.',
                        value: 'AAPL',
                    }),
                ]),
            );
        });

        it('should limit suggestions to 25 items', async () => {
            mockInteraction.options.getFocused.mockReturnValue('');

            await stockCommand.autocomplete(mockInteraction);

            expect(mockInteraction.respond).toHaveBeenCalled();
            const callArgs = mockInteraction.respond.mock.calls[0][0];
            expect(Array.isArray(callArgs)).toBe(true);
            expect(callArgs.length).toBeLessThanOrEqual(25);
        });
    });
});