import { mathTool, extractExpression } from './math';
import { createContext } from '../utils/testHelpers';

const ctx = () => ({ message: {} as never, context: createContext() as never });

describe('extractExpression', () => {
    it('strips a natural-language wrapper from the arithmetic', () => {
        expect(extractExpression('whats 15% of 240?')).toBe('15% of 240');
        expect(extractExpression('what is 2 + 2?')).toBe('2 + 2');
        expect(extractExpression('how much is 10 * 3?')).toBe('10 * 3');
    });

    it('returns null when there are no digits to work with', () => {
        expect(extractExpression('what is love?')).toBeNull();
    });
});

describe('mathTool', () => {
    it('answers an arithmetic question', async () => {
        const answer = await mathTool.run('what is 2 + 2?', ctx());
        expect(answer?.title).toBe('4');
        expect(answer?.sourceLabel).toBe('mathjs');
    });

    it('handles a percentage', async () => {
        const answer = await mathTool.run('whats 15% of 240?', ctx());
        expect(answer?.title).toBe('36');
    });

    it('returns null when the expression cannot be evaluated', async () => {
        expect(await mathTool.run('what is 2 +++ ?', ctx())).toBeNull();
    });

    it('returns null when there is no expression at all', async () => {
        expect(await mathTool.run('what is love?', ctx())).toBeNull();
    });
});
