import { timeDateTool, resolveTimeZone } from './timeDate';
import { createContext } from '../utils/testHelpers';

const ctx = () => ({ message: {} as never, context: createContext() as never });

describe('resolveTimeZone', () => {
    it('finds a city named in the question', () => {
        expect(resolveTimeZone('what time is it in tokyo?')).toBe('Asia/Tokyo');
        expect(resolveTimeZone('what time is it in new york?')).toBe('America/New_York');
    });

    it('defaults to UTC when no place is named', () => {
        expect(resolveTimeZone('what time is it?')).toBe('UTC');
    });

    it('returns null for a place it does not know', () => {
        expect(resolveTimeZone('what time is it in atlantis?')).toBeNull();
    });
});

describe('timeDateTool', () => {
    it('answers with the local time in the named zone', async () => {
        const answer = await timeDateTool.run('what time is it in tokyo?', ctx());
        expect(answer?.title).toContain('Tokyo');
        expect(answer?.body).toMatch(/\d{1,2}:\d{2}/);
        expect(answer?.sourceLabel).toBe('server clock');
    });

    it('returns null for an unknown place rather than answering about UTC', async () => {
        expect(await timeDateTool.run('what time is it in atlantis?', ctx())).toBeNull();
    });
});
