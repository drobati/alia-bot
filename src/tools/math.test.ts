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

    // Guards the \b word boundaries on the of->multiply rewrite in math.ts. An
    // unbounded /of/gi would tear into words that merely contain "of" (like
    // "profit" or "offset"), corrupting the expression instead of leaving an
    // unrecognized symbol for mathjs to reject — so this must stay null, not
    // silently return a wrong number.
    it('does not corrupt words that contain "of" as a substring', async () => {
        expect(await mathTool.run('what is the profit of 100?', ctx())).toBeNull();
        expect(await mathTool.run('what is the offset of 20?', ctx())).toBeNull();
    });
});
