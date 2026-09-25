import { evaluateExpression } from '../lib/calc-core';
import { Tool, ToolAnswer, ToolContext } from './types';

const LEAD_IN = /^\s*(?:what(?:'s| is)|whats|how much is|calculate|compute|work out)\s+/i;

/** Strips the question around the arithmetic, e.g. "15% of 240" out of "whats 15% of 240?". */
export function extractExpression(query: string): string | null {
    const expression = query
        .replace(LEAD_IN, '')
        .replace(/[?!]+\s*$/, '')
        .trim();
    if (!/\d/.test(expression)) {
        return null;
    }
    return expression.length > 0 ? expression : null;
}

/**
 * mathjs cannot parse "15% of 240" — it throws on the bare word. Rewriting a
 * standalone "of" to "*" gives "15% * 240", which mathjs reads as a percentage
 * and evaluates to 36. The word boundaries matter: without them this would also
 * rewrite the inside of words like "profit" and "offset", turning a question
 * that should go unanswered into a corrupted expression.
 */
export function toEvaluable(expression: string): string {
    return expression.replace(/\bof\b/gi, '*');
}

export const mathTool: Tool = {
    name: 'math',

    async run(query: string, _ctx: ToolContext): Promise<ToolAnswer | null> {
        void _ctx;
        const expression = extractExpression(query);
        if (!expression) {
            return null;
        }

        // Normalize only for evaluation, not for display.
        const evaluable = toEvaluable(expression);
        const result = evaluateExpression(evaluable);
        if (result === null) {
            return null;
        }

        return {
            title: result,
            body: `${expression} = ${result}`,
            sourceLabel: 'mathjs',
        };
    },
};
