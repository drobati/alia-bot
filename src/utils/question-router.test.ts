import { decide } from './question-router';
import { CONFIDENCE_FLOOR, Classification, QuestionType } from './question-types';

function classification(type: QuestionType, confidence: number): Classification {
    return { type, confidence, alternatives: [] };
}

describe('decide', () => {
    it('routes a confident tool type to its tool on both paths', () => {
        const c = classification('weather', 0.95);
        expect(decide(c, true)).toEqual({ kind: 'tool', tool: 'weather' });
        expect(decide(c, false)).toEqual({ kind: 'tool', tool: 'weather' });
    });

    it('sends a tool type below the floor to the LLM when mentioned and to silence when not', () => {
        const c = classification('general_knowledge', 0.5);
        expect(decide(c, true)).toEqual({ kind: 'llm' });
        expect(decide(c, false)).toEqual({ kind: 'silent' });
    });

    it('never diverts a non-tool type to a tool however confident it is', () => {
        const c = classification('banter_insult', 1);
        expect(decide(c, true)).toEqual({ kind: 'llm' });
        expect(decide(c, false)).toEqual({ kind: 'silent' });
    });

    it('treats a score exactly at the floor as confident', () => {
        expect(decide(classification('math', CONFIDENCE_FLOOR), false))
            .toEqual({ kind: 'tool', tool: 'math' });
    });

    it('keeps phase 2 types away from tools, since they have none yet', () => {
        for (const type of ['current_events', 'finance'] as QuestionType[]) {
            expect(decide(classification(type, 1), true)).toEqual({ kind: 'llm' });
            expect(decide(classification(type, 1), false)).toEqual({ kind: 'silent' });
        }
    });

    it('falls back safely when classification is missing', () => {
        expect(decide(null, true)).toEqual({ kind: 'llm' });
        expect(decide(null, false)).toEqual({ kind: 'silent' });
    });
});
