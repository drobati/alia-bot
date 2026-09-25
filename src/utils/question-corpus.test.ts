import corpus from './__fixtures__/classification-corpus.json';
import { decide } from './question-router';
import { CONFIDENCE_FLOOR, Classification, QuestionType } from './question-types';

function label(route: ReturnType<typeof decide>): string {
    return route.kind === 'tool' ? `tool:${route.tool}` : route.kind;
}

describe('classification corpus', () => {
    it.each(corpus)('routes $message to $expected', entry => {
        const classification: Classification = {
            type: entry.type as QuestionType,
            confidence: entry.confidence,
            alternatives: [],
        };
        expect(label(decide(classification, entry.addressed))).toBe(entry.expected);
    });

    it('keeps a case recorded just above the floor on the answering side', () => {
        // "What's the capital of France?" was measured between 0.89 and 0.92 across
        // identical runs. A taxonomy change that pushes it under the floor must fail
        // here rather than quietly go silent in production.
        const nearFloor = corpus.find(e => e.message === "What's the capital of France?")!;
        expect(nearFloor.confidence).toBeGreaterThanOrEqual(CONFIDENCE_FLOOR);
        expect(label(decide({
            type: nearFloor.type as QuestionType,
            confidence: 0.89,
            alternatives: [],
        }, true))).toBe('tool:wikipedia');
    });
});
