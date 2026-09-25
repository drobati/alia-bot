import { create, all } from 'mathjs';

// Create a mathjs instance with all functions
const math = create(all);

// /calc enforces this same limit before ever calling evaluateExpression, for a
// specific user-facing message. It lives here too so every other caller
// (currently mathTool.run) inherits it: limitedEvaluate is synchronous, and a
// pathological expression sized to fit a 2000-4000 char Discord message would
// otherwise block the event loop for the whole bot.
export const MAX_EXPRESSION_LENGTH = 500;

// Limit scope for safety - disable dangerous functions
export const limitedEvaluate = math.evaluate;
math.import({
    import: function () { throw new Error('Function import is disabled'); },
    createUnit: function () { throw new Error('Function createUnit is disabled'); },
    parse: function () { throw new Error('Function parse is disabled'); },
    simplify: function () { throw new Error('Function simplify is disabled'); },
    derivative: function () { throw new Error('Function derivative is disabled'); },
}, { override: true });

// Format the result for display
export function formatResult(result: any): string {
    if (typeof result === 'number') {
        // Handle very large or very small numbers
        if (Math.abs(result) > 1e15 || (Math.abs(result) < 1e-10 && result !== 0)) {
            return result.toExponential(10);
        }
        // Round to avoid floating point display issues
        const rounded = Math.round(result * 1e10) / 1e10;
        return rounded.toLocaleString('en-US', { maximumFractionDigits: 10 });
    }

    // Handle mathjs objects (like units, complex numbers, etc.)
    if (result && typeof result.toString === 'function') {
        return result.toString();
    }

    return String(result);
}

/** Evaluates an expression, returning null when mathjs cannot. */
export function evaluateExpression(expression: string): string | null {
    if (expression.length > MAX_EXPRESSION_LENGTH) {
        return null;
    }
    try {
        const result = limitedEvaluate(expression);
        if (result === undefined || result === null) {
            return null;
        }
        return formatResult(result);
    } catch {
        return null;
    }
}
