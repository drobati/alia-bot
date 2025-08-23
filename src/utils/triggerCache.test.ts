import { triggerCache } from './triggerCache';

describe('TriggerCache', () => {
    beforeEach(() => {
        triggerCache.invalidateCache();
    });

    it('starts empty and not loaded', () => {
        expect(triggerCache.isReady()).toBe(false);
        expect(triggerCache.getTriggers()).toEqual([]);
    });

    it('loads triggers from database', async () => {
        const mockMemories = {
            findAll: jest.fn().mockResolvedValue([
                { key: 'hello', value: 'world' },
                { key: 'CAPS', value: 'response' },
            ]),
        };

        await triggerCache.loadTriggers(mockMemories);

        expect(triggerCache.isReady()).toBe(true);
        expect(triggerCache.getTriggers()).toEqual([
            { key: 'hello', value: 'world' },
            { key: 'caps', value: 'response' },
        ]);
        expect(mockMemories.findAll).toHaveBeenCalledWith({
            where: { triggered: true },
            raw: true,
        });
    });

    it('adds triggers to cache', () => {
        triggerCache.addTrigger('test', 'response');
        
        expect(triggerCache.getTriggers()).toEqual([
            { key: 'test', value: 'response' },
        ]);
    });

    it('removes triggers from cache', () => {
        triggerCache.addTrigger('test1', 'response1');
        triggerCache.addTrigger('test2', 'response2');
        triggerCache.removeTrigger('test1');
        
        expect(triggerCache.getTriggers()).toEqual([
            { key: 'test2', value: 'response2' },
        ]);
    });

    it('updates existing trigger when adding with same key', () => {
        triggerCache.addTrigger('test', 'old response');
        triggerCache.addTrigger('test', 'new response');
        
        expect(triggerCache.getTriggers()).toEqual([
            { key: 'test', value: 'new response' },
        ]);
    });

    it('updates trigger status - enable trigger', () => {
        triggerCache.updateTriggerStatus('test', true, 'response');
        
        expect(triggerCache.getTriggers()).toEqual([
            { key: 'test', value: 'response' },
        ]);
    });

    it('updates trigger status - disable trigger', () => {
        triggerCache.addTrigger('test', 'response');
        triggerCache.updateTriggerStatus('test', false, 'response');
        
        expect(triggerCache.getTriggers()).toEqual([]);
    });

    it('handles case-insensitive keys', () => {
        triggerCache.addTrigger('HELLO', 'world');
        triggerCache.addTrigger('hello', 'updated');
        
        // Should only have one trigger with lowercase key
        expect(triggerCache.getTriggers()).toEqual([
            { key: 'hello', value: 'updated' },
        ]);
    });
});