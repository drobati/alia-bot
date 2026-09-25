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

    it('strips trailing filler words around the place name', () => {
        expect(resolveTimeZone('what time is it in tokyo right now?')).toBe('Asia/Tokyo');
        expect(resolveTimeZone('what time is it in new york today?')).toBe('America/New_York');
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
        // A crash inside Intl.DateTimeFormat would also be caught and return
        // null, which would make this test pass for the wrong reason. Assert
        // the formatter was never reached, proving this is an early refusal
        // and not an attempt that failed and got swallowed.
        const spy = jest.spyOn(Intl, 'DateTimeFormat');
        expect(await timeDateTool.run('what time is it in atlantis?', ctx())).toBeNull();
        expect(spy).not.toHaveBeenCalled();
        spy.mockRestore();
    });
});
