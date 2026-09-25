import { mathTool, extractExpression, toEvaluable } from './math';
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

    // Discord messages reach 2000-4000 chars and limitedEvaluate is synchronous;
    // without a cap a pathological expression would block the event loop for
    // the whole bot. /calc enforces this itself, but mathTool has no other gate.
    it('returns null for an over-long expression', async () => {
        const longExpression = `what is ${'1+'.repeat(300)}1?`;
        expect(await mathTool.run(longExpression, ctx())).toBeNull();
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

describe('toEvaluable', () => {
    it('rewrites a standalone "of" so mathjs reads a percentage', () => {
        expect(toEvaluable('15% of 240')).toBe('15% * 240');
    });

    it('leaves "of" inside a word alone', () => {
        // Without word boundaries this becomes "the pr*it * 100" and a question
        // that should go unanswered turns into a corrupted expression instead.
        expect(toEvaluable('the profit of 100')).toBe('the profit * 100');
        expect(toEvaluable('the offset of 20')).toBe('the offset * 20');
    });
});
