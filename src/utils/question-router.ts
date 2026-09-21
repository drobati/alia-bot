import { Classification, CONFIDENCE_FLOOR, TOOL_FOR, ToolName } from './question-types';

export type Route =
    | { kind: 'tool'; tool: ToolName }
    | { kind: 'llm' }
    | { kind: 'silent' };

/**
 * The whole routing rule. Confidence gates one direction only: it is needed to
 * divert a message away from Alia and into a tool, never to let her answer as
 * herself. So a weak classification degrades to today's behaviour when she was
 * addressed, and to silence when she was not.
 */
export function decide(classification: Classification | null, addressedToBot: boolean): Route {
    const fallback: Route = addressedToBot ? { kind: 'llm' } : { kind: 'silent' };
    if (!classification) {
        return fallback;
    }

    const tool = TOOL_FOR[classification.type];
    if (tool && classification.confidence >= CONFIDENCE_FLOOR) {
        return { kind: 'tool', tool };
    }
    return fallback;
}
