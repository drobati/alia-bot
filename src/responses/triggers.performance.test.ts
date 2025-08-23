import { triggerCache } from '../utils/triggerCache';
import triggers from './triggers';
import { createContext, createTable } from '../utils/testHelpers';

describe('Triggers Performance Test', () => {
    let context: any, message: any, Memories: any;

    beforeEach(() => {
        triggerCache.invalidateCache();

        context = createContext();
        message = {
            content: 'test message',
            channel: { send: jest.fn() },
        };
        Memories = createTable();
        context.tables = { Memories };
    });

    it('should minimize database calls with caching', async () => {
        // Mock database response
        const mockTriggers = [
            { key: 'hello', value: 'world' },
            { key: 'test', value: 'response' },
        ];
        Memories.findAll.mockResolvedValue(mockTriggers);

        // First call should load cache
        await triggers(message, context);
        expect(Memories.findAll).toHaveBeenCalledTimes(1);

        // Subsequent calls should NOT hit database
        await triggers(message, context);
        await triggers(message, context);
        await triggers(message, context);

        // Database should still only be called once
        expect(Memories.findAll).toHaveBeenCalledTimes(1);
    });

    it('should work efficiently with many triggers', async () => {
        // Create 1000 mock triggers
        const manyTriggers = Array.from({ length: 1000 }, (_, i) => ({
            key: `trigger${i}`,
            value: `response${i}`,
        }));
        Memories.findAll.mockResolvedValue(manyTriggers);

        const start = Date.now();

        // Load cache once
        await triggers(message, context);

        // Process 100 messages without hitting database
        for (let i = 0; i < 100; i++) {
            message.content = `test message ${i}`;
            await triggers(message, context);
        }

        const end = Date.now();
        const duration = end - start;

        // Should be very fast (under 100ms for 100 messages + 1000 triggers)
        expect(duration).toBeLessThan(100);

        // Database should only be called once (for initial cache load)
        expect(Memories.findAll).toHaveBeenCalledTimes(1);

        // eslint-disable-next-line no-console
        console.log(`Processed 100 messages with 1000 triggers in ${duration}ms`);
        // eslint-disable-next-line no-console
        console.log(`Average: ${duration / 100}ms per message`);
    });
});