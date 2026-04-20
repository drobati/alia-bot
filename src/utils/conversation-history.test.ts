import {
    recordMessage,
    getHistory,
    clearHistory,
    _resetForTests,
} from './conversation-history';

describe('conversation-history', () => {
    beforeEach(() => {
        _resetForTests();
    });

    it('records and returns messages in order', () => {
        recordMessage('c1', 'user', 'alice', 'hi');
        recordMessage('c1', 'assistant', 'Alia', 'hey');
        recordMessage('c1', 'user', 'bob', 'sup');

        const h = getHistory('c1');
        expect(h).toHaveLength(3);
        expect(h[0].content).toBe('hi');
        expect(h[2].username).toBe('bob');
    });

    it('isolates channels from each other', () => {
        recordMessage('c1', 'user', 'alice', 'hi');
        recordMessage('c2', 'user', 'bob', 'hey');

        expect(getHistory('c1')).toHaveLength(1);
        expect(getHistory('c2')).toHaveLength(1);
        expect(getHistory('c1')[0].username).toBe('alice');
    });

    it('caps history at MAX_ENTRIES (6)', () => {
        for (let i = 0; i < 10; i++) {
            recordMessage('c1', 'user', 'alice', `msg ${i}`);
        }
        const h = getHistory('c1');
        expect(h).toHaveLength(6);
        expect(h[0].content).toBe('msg 4');
        expect(h[5].content).toBe('msg 9');
    });

    it('expires stale channels after TTL', () => {
        recordMessage('c1', 'user', 'alice', 'hi', 0);
        expect(getHistory('c1', 0)).toHaveLength(1);
        // 6 minutes later — past the 5-minute TTL
        expect(getHistory('c1', 6 * 60 * 1000)).toHaveLength(0);
    });

    it('clearHistory removes a specific channel', () => {
        recordMessage('c1', 'user', 'alice', 'hi');
        recordMessage('c2', 'user', 'bob', 'hey');
        clearHistory('c1');
        expect(getHistory('c1')).toHaveLength(0);
        expect(getHistory('c2')).toHaveLength(1);
    });

    it('returns a copy so callers cannot mutate internal state', () => {
        recordMessage('c1', 'user', 'alice', 'hi');
        const h = getHistory('c1');
        h.push({ role: 'user', username: 'x', content: 'x', timestamp: 0 });
        expect(getHistory('c1')).toHaveLength(1);
    });
});
