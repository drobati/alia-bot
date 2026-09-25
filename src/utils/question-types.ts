export type QuestionType =
    | 'general_knowledge'
    | 'weather'
    | 'math'
    | 'time_date'
    | 'server_member'
    | 'current_events'
    | 'finance'
    | 'about_alia'
    | 'banter_insult'
    | 'compliment'
    | 'statement_to_alia'
    | 'request_action'
    | 'bot_capability'
    | 'opinion'
    | 'directed_at_human'
    | 'rhetorical'
    | 'venting';

/**
 * Measured, not chosen. Clear tool questions bottom out at 0.89 and ambiguous
 * ones reach at most 0.79, so the floor sits in the gap. See the spec.
 */
export const CONFIDENCE_FLOOR = 0.85;

/**
 * Sent to Jev verbatim as the choice criteria. This wording is tuned: adding a
 * type or rewording one shifts confidence across every other type, so any edit
 * here requires re-running the regression corpus.
 */
export const TYPE_CRITERIA: Record<QuestionType, string> = {
    general_knowledge: 'a factual question about the world answerable from an encyclopedia',
    weather: 'asking about weather or forecast',
    math: 'an arithmetic or calculation request',
    time_date: 'asking the current time or date, possibly in another place',
    server_member: 'a question about a specific person in this Discord server',
    current_events: 'a factual question about recent news needing an up-to-date source',
    finance: 'asking a stock, crypto or market price',
    about_alia: "asking about the bot's inner life: its feelings, opinions or personality",
    banter_insult: 'teasing, insulting or provoking the bot',
    compliment: 'praising or thanking the bot',
    statement_to_alia: 'a statement addressed to the bot that is not a question',
    request_action: 'instructing the bot to perform a task right now',
    bot_capability: 'asking which features, commands or abilities the bot offers',
    opinion: 'asking for a subjective preference or opinion rather than a fact',
    directed_at_human: 'a question aimed at another person in the chat',
    rhetorical: 'a rhetorical question not seeking an answer',
    venting: 'expressing frustration or emotion, not seeking facts',
};

export type ToolName = 'wikipedia' | 'weather' | 'math' | 'time_date' | 'server_member';

/**
 * Phase 1. `current_events` and `finance` classify correctly but have no tool,
 * so they route like any other non-tool type.
 */
export const TOOL_FOR: Partial<Record<QuestionType, ToolName>> = {
    general_knowledge: 'wikipedia',
    weather: 'weather',
    math: 'math',
    time_date: 'time_date',
    server_member: 'server_member',
};

export interface TypeProbability {
    type: QuestionType;
    p: number;
}

export interface Classification {
    type: QuestionType;
    confidence: number;
    /** Runners-up, highest first. The diagnosis for a rejected message. */
    alternatives: TypeProbability[];
}
