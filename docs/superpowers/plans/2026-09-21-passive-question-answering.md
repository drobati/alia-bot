# Passive Question Answering Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Alia classifies every message she handles with Jev, answers factual questions from a cited source, and answers them in opted-in channels without being mentioned.

**Architecture:** One classifier in front of both paths. `classify()` returns a type, a confidence and the runner-up types. A pure `decide()` function turns that into `tool`, `llm` or `silent`. Mentioned messages fall back to today's LLM; passive messages fall back to silence. Tools are independent modules behind one interface.

**Tech Stack:** TypeScript, discord.js v14, Sequelize 6 (MySQL), Jest, mathjs, Jev (`typesafe/jev-1.13`) over OpenRouter.

**Spec:** `docs/superpowers/specs/2026-09-21-passive-question-answering-design.md`

## Global Constraints

- `CONFIDENCE_FLOOR` is **0.85**. One exported constant, never inlined.
- Phase 1 tool types only: `general_knowledge`, `weather`, `math`, `time_date`, `server_member`. `current_events` and `finance` exist in the taxonomy but have **no tool** and therefore never route to one.
- `bot_capability` is an LLM type, not a tool type. Do not add a tool for it.
- Tests **assert the route, never the confidence**. The model does not return a stable score.
- Tests **never call the network**. Classifier and tool tests replay recorded payloads through an injected `fetch`.
- The criteria strings in `TYPE_CRITERIA` are a tuned artifact. Do not reword them in this plan; rewording shifts confidence across all types.
- Model id comes from `process.env.JEV_MODEL`, defaulting to `typesafe/jev-1.13`. Never hardcode it at a call site.
- Credentials come from `process.env.OPENROUTER_API_KEY`, already used by `src/utils/assistant.ts`.
- A classifier or tool failure must never leave Alia silent toward someone who mentioned her. Degrade to the existing LLM path and log it.
- Run `npx jest <path>` for single suites and `npm test` for the full run. Pre-existing failures: 12 suites / 24 tests fail on `master` (unrelated — `yahoo-finance2` is missing). Compare against that baseline, do not try to fix them.

---

### Task 1: Taxonomy and the pure router

The foundation. No I/O, no Discord, no database. Every later task imports these types.

**Files:**
- Create: `src/utils/question-types.ts`
- Create: `src/utils/question-router.ts`
- Test: `src/utils/question-router.test.ts`

**Interfaces:**
- Consumes: nothing.
- Produces: `QuestionType`, `Classification`, `CONFIDENCE_FLOOR`, `TYPE_CRITERIA`, `TOOL_FOR`, `Route`, `decide(classification, addressedToBot)`.

- [ ] **Step 1: Write `src/utils/question-types.ts`**

```ts
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
```

- [ ] **Step 2: Write the failing router test**

Create `src/utils/question-router.test.ts`:

```ts
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
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest src/utils/question-router.test.ts`
Expected: FAIL — `Cannot find module './question-router'`.

- [ ] **Step 4: Write `src/utils/question-router.ts`**

```ts
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
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx jest src/utils/question-router.test.ts`
Expected: PASS, 6 tests.

- [ ] **Step 6: Commit**

```bash
git add src/utils/question-types.ts src/utils/question-router.ts src/utils/question-router.test.ts
git commit -m "feat(questions): taxonomy and the pure routing rule"
```

---

### Task 2: The Jev classifier

**Files:**
- Create: `src/utils/question-classifier.ts`
- Test: `src/utils/question-classifier.test.ts`

**Interfaces:**
- Consumes: `QuestionType`, `Classification`, `TYPE_CRITERIA` from Task 1.
- Produces: `classify(content, { addressedToBot }, deps?) => Promise<Classification | null>` and `ClassifierDeps`.

`classify` returns `null` on any failure — transport, non-200, malformed body, unknown type. The caller decides what a `null` means; `decide()` already handles it.

- [ ] **Step 1: Write the failing test**

Create `src/utils/question-classifier.test.ts`:

```ts
import { classify } from './question-classifier';

function fakeFetch(body: unknown, status = 200) {
    return jest.fn().mockResolvedValue({
        ok: status >= 200 && status < 300,
        status,
        json: async () => body,
    });
}

const LOG = { info: jest.fn(), debug: jest.fn(), warn: jest.fn(), error: jest.fn() };

describe('classify', () => {
    beforeEach(() => jest.clearAllMocks());

    it('returns the winning type, its confidence and the runners-up', async () => {
        const fetchMock = fakeFetch({
            model: 'typesafe/jev-1.13-20260917',
            answers: {
                kind: {
                    type: 'choice',
                    choice: 'general_knowledge',
                    probabilities: { general_knowledge: 0.92, directed_at_human: 0.08, weather: 0 },
                    confidence: 0.91,
                },
            },
            usage: { input_tokens: 300 },
        });

        const result = await classify('capital of France?', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });

        expect(result).toEqual({
            type: 'general_knowledge',
            confidence: 0.92,
            alternatives: [{ type: 'directed_at_human', p: 0.08 }],
        });
    });

    it('derives confidence from the distribution rather than trusting the provider field', async () => {
        // The provider's own `confidence` is ignored: the top probability is the
        // number the floor is calibrated against.
        const fetchMock = fakeFetch({
            model: 'm',
            answers: {
                kind: {
                    type: 'choice',
                    choice: 'weather',
                    probabilities: { weather: 0.95, opinion: 0.05 },
                    confidence: 0.1,
                },
            },
        });

        const result = await classify('rain?', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });

        expect(result?.confidence).toBe(0.95);
    });

    it('sends the model id and the addressed flag', async () => {
        const fetchMock = fakeFetch({
            model: 'm',
            answers: { kind: { type: 'choice', choice: 'compliment', probabilities: { compliment: 1 } } },
        });

        await classify('you rule', { addressedToBot: true },
            { fetch: fetchMock as never, apiKey: 'k', model: 'typesafe/jev-1.13', log: LOG as never });

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://openrouter.ai/api/v1/systemone');
        const body = JSON.parse(init.body);
        expect(body.model).toBe('typesafe/jev-1.13');
        expect(body.state).toEqual({ discord_message: 'you rule', addressed_to_bot: true });
        expect(Object.keys(body.questions.kind.criteria)).toContain('general_knowledge');
    });

    it('returns null on a non-200 rather than throwing', async () => {
        const fetchMock = fakeFetch({ error: { message: 'nope' } }, 400);
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
        expect(LOG.error).toHaveBeenCalled();
    });

    it('returns null when the body is malformed', async () => {
        const fetchMock = fakeFetch({ answers: {} });
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
    });

    it('returns null when the model names a type we do not know', async () => {
        const fetchMock = fakeFetch({
            model: 'm',
            answers: { kind: { type: 'choice', choice: 'astrology', probabilities: { astrology: 1 } } },
        });
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
    });

    it('returns null when no api key is configured', async () => {
        const fetchMock = fakeFetch({});
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: '', log: LOG as never });
        expect(result).toBeNull();
        expect(fetchMock).not.toHaveBeenCalled();
    });

    it('returns null when the transport throws', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('ECONNRESET'));
        const result = await classify('hi', { addressedToBot: false },
            { fetch: fetchMock as never, apiKey: 'k', log: LOG as never });
        expect(result).toBeNull();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/utils/question-classifier.test.ts`
Expected: FAIL — `Cannot find module './question-classifier'`.

- [ ] **Step 3: Write `src/utils/question-classifier.ts`**

```ts
import {
    Classification,
    QuestionType,
    TYPE_CRITERIA,
    TypeProbability,
} from './question-types';
import { BotLogger } from './logger';

const ENDPOINT = 'https://openrouter.ai/api/v1/systemone';
const DEFAULT_MODEL = 'typesafe/jev-1.13';
const TIMEOUT_MS = 8000;
const MAX_ALTERNATIVES = 2;

const INSTRUCTIONS =
    'Classify this Discord message sent in a friend-group server where a bot named Alia listens.';

export interface ClassifierDeps {
    fetch?: typeof fetch;
    apiKey?: string;
    model?: string;
    log?: BotLogger;
}

const KNOWN_TYPES = new Set(Object.keys(TYPE_CRITERIA));

function isQuestionType(value: string): value is QuestionType {
    return KNOWN_TYPES.has(value);
}

/**
 * Classifies one message with Jev. Returns null on every failure mode; the
 * caller decides what silence means, and `decide()` already treats null as
 * "no tool".
 */
export async function classify(
    content: string,
    opts: { addressedToBot: boolean },
    deps: ClassifierDeps = {},
): Promise<Classification | null> {
    const doFetch = deps.fetch ?? fetch;
    const log = deps.log;
    const apiKey = deps.apiKey ?? process.env.OPENROUTER_API_KEY;
    // Never hardcoded at a call site: a retired model id is how Alia went quiet before.
    const model = deps.model ?? process.env.JEV_MODEL ?? DEFAULT_MODEL;

    if (!apiKey) {
        log?.error('Question classifier has no OPENROUTER_API_KEY; not classifying');
        return null;
    }

    const body = JSON.stringify({
        model,
        state: { discord_message: content, addressed_to_bot: opts.addressedToBot },
        questions: {
            kind: { type: 'choice', instructions: INSTRUCTIONS, criteria: TYPE_CRITERIA },
        },
    });

    try {
        const response = await doFetch(ENDPOINT, {
            method: 'POST',
            headers: { authorization: `Bearer ${apiKey}`, 'content-type': 'application/json' },
            body,
            signal: AbortSignal.timeout(TIMEOUT_MS),
        });

        if (!response.ok) {
            log?.error('Question classifier request failed', { status: response.status, model });
            return null;
        }

        const json = await response.json() as {
            answers?: { kind?: { choice?: string; probabilities?: Record<string, number> } };
        };
        const answer = json?.answers?.kind;
        if (!answer?.choice || !answer.probabilities) {
            log?.error('Question classifier returned an unusable answer', { model });
            return null;
        }
        if (!isQuestionType(answer.choice)) {
            log?.error('Question classifier returned an unknown type', { choice: answer.choice });
            return null;
        }

        const ranked: TypeProbability[] = Object.entries(answer.probabilities)
            .filter(([type, p]) => isQuestionType(type) && p > 0)
            .map(([type, p]) => ({ type: type as QuestionType, p }))
            .sort((a, b) => b.p - a.p);

        // The top probability is the number the floor is calibrated against.
        // The provider also returns its own `confidence`, which is not used.
        const confidence = ranked.find(entry => entry.type === answer.choice)?.p ?? 0;

        return {
            type: answer.choice,
            confidence,
            alternatives: ranked
                .filter(entry => entry.type !== answer.choice)
                .slice(0, MAX_ALTERNATIVES),
        };
    } catch (error) {
        log?.error('Question classifier threw', { error, model });
        return null;
    }
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx jest src/utils/question-classifier.test.ts`
Expected: PASS, 8 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/question-classifier.ts src/utils/question-classifier.test.ts
git commit -m "feat(questions): classify messages with Jev over OpenRouter"
```

---

### Task 3: ClassificationLog table and writer

**Files:**
- Create: `src/models/classificationLog.ts`
- Create: `migrations/20260921000000-create-classification-log-table.js`
- Modify: `src/models/index.ts`
- Create: `src/utils/classification-log.ts`
- Test: `src/utils/classification-log.test.ts`

**Interfaces:**
- Consumes: `Classification` from Task 1, `Route` from Task 1.
- Produces: `recordClassification(context, params) => Promise<void>` and `pruneClassificationLog(context, olderThanDays) => Promise<number>`.

- [ ] **Step 1: Write the model**

Create `src/models/classificationLog.ts`, following `src/models/userDescriptions.ts`:

```ts
import { DataTypes } from 'sequelize';

export default (sequelize: any) => ({
    ClassificationLog: sequelize.define('ClassificationLog', {
        id: {
            type: DataTypes.INTEGER,
            primaryKey: true,
            autoIncrement: true,
        },
        guild_id: { type: DataTypes.STRING, allowNull: false },
        channel_id: { type: DataTypes.STRING, allowNull: false },
        message_id: { type: DataTypes.STRING, allowNull: false },
        content: {
            type: DataTypes.STRING(255),
            allowNull: false,
            comment: 'Truncated. Enough to tune the taxonomy, small enough to prune cheaply.',
        },
        addressed: {
            type: DataTypes.BOOLEAN,
            allowNull: false,
            comment: 'Mentioned Alia, versus picked up passively',
        },
        type: { type: DataTypes.STRING, allowNull: false },
        confidence: { type: DataTypes.FLOAT, allowNull: false },
        alternatives: {
            type: DataTypes.JSON,
            allowNull: true,
            comment: 'Runners-up with probabilities. The runner-up is the diagnosis.',
        },
        route: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'tool:<name>, llm or silent',
        },
        reason: {
            type: DataTypes.STRING,
            allowNull: false,
            comment: 'below_floor or tool_no_answer',
        },
        created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW },
    }, {
        tableName: 'classification_logs',
        timestamps: false,
    }),
});
```

- [ ] **Step 2: Write the migration**

Create `migrations/20260921000000-create-classification-log-table.js`:

```js
'use strict';

module.exports = {
    async up(queryInterface, Sequelize) {
        await queryInterface.createTable('classification_logs', {
            id: { type: Sequelize.INTEGER, primaryKey: true, autoIncrement: true, allowNull: false },
            guild_id: { type: Sequelize.STRING, allowNull: false },
            channel_id: { type: Sequelize.STRING, allowNull: false },
            message_id: { type: Sequelize.STRING, allowNull: false },
            content: { type: Sequelize.STRING(255), allowNull: false },
            addressed: { type: Sequelize.BOOLEAN, allowNull: false },
            type: { type: Sequelize.STRING, allowNull: false },
            confidence: { type: Sequelize.FLOAT, allowNull: false },
            alternatives: { type: Sequelize.JSON, allowNull: true },
            route: { type: Sequelize.STRING, allowNull: false },
            reason: { type: Sequelize.STRING, allowNull: false },
            created_at: { type: Sequelize.DATE, allowNull: false, defaultValue: Sequelize.NOW },
        });
        await queryInterface.addIndex('classification_logs', ['created_at']);
        await queryInterface.addIndex('classification_logs', ['type']);
    },

    async down(queryInterface) {
        await queryInterface.dropTable('classification_logs');
    },
};
```

- [ ] **Step 3: Register the model**

In `src/models/index.ts`, add the import beside the others and the entry in the exported object:

```ts
import ClassificationLog from "./classificationLog";
```

and add `ClassificationLog,` to the export object alongside `Clip,`.

- [ ] **Step 4: Write the failing writer test**

Create `src/utils/classification-log.test.ts`:

```ts
import { recordClassification, pruneClassificationLog } from './classification-log';
import { createContext, createTable } from './testHelpers';

describe('recordClassification', () => {
    let context: ReturnType<typeof createContext>;
    let table: ReturnType<typeof createTable>;

    beforeEach(() => {
        context = createContext();
        table = createTable();
        context.tables.ClassificationLog = table;
    });

    const params = {
        guildId: 'g1',
        channelId: 'c1',
        messageId: 'm1',
        content: 'what can you do?',
        addressed: false,
        classification: {
            type: 'bot_capability' as const,
            confidence: 0.75,
            alternatives: [{ type: 'directed_at_human' as const, p: 0.23 }],
        },
        route: 'silent',
        reason: 'below_floor' as const,
    };

    it('writes the winner, the confidence and the runners-up', async () => {
        await recordClassification(context as never, params);

        expect(table.create).toHaveBeenCalledWith(expect.objectContaining({
            guild_id: 'g1',
            channel_id: 'c1',
            message_id: 'm1',
            content: 'what can you do?',
            addressed: false,
            type: 'bot_capability',
            confidence: 0.75,
            alternatives: [{ type: 'directed_at_human', p: 0.23 }],
            route: 'silent',
            reason: 'below_floor',
        }));
    });

    it('truncates content to the column width', async () => {
        await recordClassification(context as never, { ...params, content: 'x'.repeat(400) });

        const written = table.create.mock.calls[0][0];
        expect(written.content).toHaveLength(255);
    });

    it('never throws when the insert fails, and warns instead', async () => {
        table.create.mockRejectedValue(new Error('db down'));

        await expect(recordClassification(context as never, params)).resolves.toBeUndefined();
        expect(context.log.warn).toHaveBeenCalled();
    });
});

describe('pruneClassificationLog', () => {
    it('destroys rows older than the cutoff and returns the count', async () => {
        const context = createContext();
        const table = createTable();
        table.destroy.mockResolvedValue(7);
        context.tables.ClassificationLog = table;

        const removed = await pruneClassificationLog(context as never, 30);

        expect(removed).toBe(7);
        expect(table.destroy).toHaveBeenCalledWith(
            expect.objectContaining({ where: expect.anything() }),
        );
    });
});
```

- [ ] **Step 5: Run it and watch it fail**

Run: `npx jest src/utils/classification-log.test.ts`
Expected: FAIL — `Cannot find module './classification-log'`.

- [ ] **Step 6: Write `src/utils/classification-log.ts`**

```ts
import { Op } from 'sequelize';
import { Classification } from './question-types';
import { Context } from './types';

const MAX_CONTENT = 255;

export type LogReason = 'below_floor' | 'tool_no_answer';

export interface RecordParams {
    guildId: string;
    channelId: string;
    messageId: string;
    content: string;
    addressed: boolean;
    classification: Classification;
    route: string;
    reason: LogReason;
}

/**
 * Records a classification the floor rejected, or one whose tool could not
 * answer. A filter that discards what it rejects cannot be tuned, and the
 * runners-up are the only way to see which types competed.
 *
 * Never throws and never blocks a reply: a logging failure is a warning.
 */
export async function recordClassification(context: Context, params: RecordParams): Promise<void> {
    try {
        await context.tables.ClassificationLog.create({
            guild_id: params.guildId,
            channel_id: params.channelId,
            message_id: params.messageId,
            content: params.content.slice(0, MAX_CONTENT),
            addressed: params.addressed,
            type: params.classification.type,
            confidence: params.classification.confidence,
            alternatives: params.classification.alternatives,
            route: params.route,
            reason: params.reason,
        });
    } catch (error) {
        context.log.warn('Failed to record classification', { error });
    }
}

/** Removes rows older than `olderThanDays`. Returns how many went. */
export async function pruneClassificationLog(
    context: Context,
    olderThanDays: number,
): Promise<number> {
    const cutoff = new Date(Date.now() - olderThanDays * 24 * 60 * 60 * 1000);
    try {
        return await context.tables.ClassificationLog.destroy({
            where: { created_at: { [Op.lt]: cutoff } },
        });
    } catch (error) {
        context.log.warn('Failed to prune classification log', { error });
        return 0;
    }
}
```

- [ ] **Step 7: Run the tests and watch them pass**

Run: `npx jest src/utils/classification-log.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 8: Commit**

```bash
git add src/models/classificationLog.ts src/models/index.ts migrations/20260921000000-create-classification-log-table.js src/utils/classification-log.ts src/utils/classification-log.test.ts
git commit -m "feat(questions): record the classifications the floor rejects"
```

---

### Task 4: The answer embed

One place builds every tool answer, so every source is cited the same way.

**Files:**
- Create: `src/tools/types.ts`
- Create: `src/utils/answer-embed.ts`
- Test: `src/utils/answer-embed.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `ToolAnswer`, `ToolContext`, `Tool`, `buildAnswerEmbed(answer) => EmbedBuilder`.

- [ ] **Step 1: Write `src/tools/types.ts`**

```ts
import { Message } from 'discord.js';
import { Context } from '../utils/types';

export interface ToolAnswer {
    title: string;
    body: string;
    /** Where the answer came from, linked in the embed when present. */
    url?: string;
    /** Shown as the source, e.g. "Wikipedia". */
    sourceLabel: string;
}

export interface ToolContext {
    message: Message;
    context: Context;
}

export interface Tool {
    name: string;
    /**
     * Returns null when the tool cannot answer: no article, a geocode miss, an
     * unparseable expression. That is not an error. The caller falls back to the
     * LLM when Alia was addressed, and to silence when she was not.
     *
     * `deps` lets a tool take an injected fetch in tests. Tools that need
     * nothing injected simply ignore it.
     */
    run(query: string, ctx: ToolContext, deps?: unknown): Promise<ToolAnswer | null>;
}
```

- [ ] **Step 2: Write the failing embed test**

Create `src/utils/answer-embed.test.ts`:

```ts
import { buildAnswerEmbed } from './answer-embed';

describe('buildAnswerEmbed', () => {
    it('shows the title, the body and the source', () => {
        const embed = buildAnswerEmbed({
            title: 'Paris',
            body: 'Paris is the capital of France.',
            url: 'https://en.wikipedia.org/wiki/Paris',
            sourceLabel: 'Wikipedia',
        });
        const json = embed.toJSON();

        expect(json.title).toBe('Paris');
        expect(json.description).toBe('Paris is the capital of France.');
        expect(json.url).toBe('https://en.wikipedia.org/wiki/Paris');
        expect(json.footer?.text).toBe('Source: Wikipedia');
    });

    it('omits the url when the tool has none', () => {
        const embed = buildAnswerEmbed({ title: '36', body: '15% of 240 is 36', sourceLabel: 'mathjs' });
        expect(embed.toJSON().url).toBeUndefined();
    });

    it('truncates a body past the Discord description limit', () => {
        const embed = buildAnswerEmbed({ title: 't', body: 'x'.repeat(5000), sourceLabel: 's' });
        expect(embed.toJSON().description!.length).toBeLessThanOrEqual(4096);
    });

    it('truncates a title past the Discord title limit', () => {
        const embed = buildAnswerEmbed({ title: 'x'.repeat(400), body: 'b', sourceLabel: 's' });
        expect(embed.toJSON().title!.length).toBeLessThanOrEqual(256);
    });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest src/utils/answer-embed.test.ts`
Expected: FAIL — `Cannot find module './answer-embed'`.

- [ ] **Step 4: Write `src/utils/answer-embed.ts`**

```ts
import { EmbedBuilder } from 'discord.js';
import { ToolAnswer } from '../tools/types';

const EMBED_COLOR = 0x5865f2;
const MAX_TITLE = 256;
const MAX_DESCRIPTION = 4096;

function clamp(value: string, limit: number): string {
    return value.length <= limit ? value : `${value.slice(0, limit - 1)}…`;
}

/**
 * Every tool answer goes through here, so the source is cited identically and
 * no tool invents its own layout.
 */
export function buildAnswerEmbed(answer: ToolAnswer): EmbedBuilder {
    const embed = new EmbedBuilder()
        .setColor(EMBED_COLOR)
        .setTitle(clamp(answer.title, MAX_TITLE))
        .setDescription(clamp(answer.body, MAX_DESCRIPTION))
        .setFooter({ text: `Source: ${answer.sourceLabel}` });

    if (answer.url) {
        embed.setURL(answer.url);
    }
    return embed;
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx jest src/utils/answer-embed.test.ts`
Expected: PASS, 4 tests.

- [ ] **Step 6: Commit**

```bash
git add src/tools/types.ts src/utils/answer-embed.ts src/utils/answer-embed.test.ts
git commit -m "feat(questions): one embed for every cited tool answer"
```

---

### Task 5: Wikipedia tool

**Files:**
- Create: `src/tools/wikipedia.ts`
- Test: `src/tools/wikipedia.test.ts`

**Interfaces:**
- Consumes: `Tool`, `ToolAnswer`, `ToolContext` from Task 4.
- Produces: `wikipediaTool: Tool` (`name: 'wikipedia'`), and `WikipediaDeps { fetch?: typeof fetch }` as an optional third argument for tests.

Uses the public REST summary endpoint, which needs no key.

- [ ] **Step 1: Write the failing test**

Create `src/tools/wikipedia.test.ts`:

```ts
import { wikipediaTool } from './wikipedia';
import { createContext } from '../utils/testHelpers';

const ctx = () => ({ message: {} as never, context: createContext() as never });

function fetchReturning(...responses: Array<{ status: number; body: unknown }>) {
    const mock = jest.fn();
    for (const r of responses) {
        mock.mockResolvedValueOnce({
            ok: r.status >= 200 && r.status < 300,
            status: r.status,
            json: async () => r.body,
        });
    }
    return mock;
}

describe('wikipediaTool', () => {
    it('answers with the summary extract and links the article', async () => {
        const fetchMock = fetchReturning(
            { status: 200, body: { query: { search: [{ title: 'Paris' }] } } },
            {
                status: 200,
                body: {
                    title: 'Paris',
                    extract: 'Paris is the capital and largest city of France.',
                    content_urls: { desktop: { page: 'https://en.wikipedia.org/wiki/Paris' } },
                },
            },
        );

        const answer = await wikipediaTool.run("what's the capital of France?", ctx(), { fetch: fetchMock as never });

        expect(answer).toEqual({
            title: 'Paris',
            body: 'Paris is the capital and largest city of France.',
            url: 'https://en.wikipedia.org/wiki/Paris',
            sourceLabel: 'Wikipedia',
        });
    });

    it('returns null when nothing matches, so the caller can fall back', async () => {
        const fetchMock = fetchReturning({ status: 200, body: { query: { search: [] } } });
        expect(await wikipediaTool.run('asdfqwer', ctx(), { fetch: fetchMock as never })).toBeNull();
    });

    it('returns null when the article has no extract', async () => {
        const fetchMock = fetchReturning(
            { status: 200, body: { query: { search: [{ title: 'Empty' }] } } },
            { status: 200, body: { title: 'Empty', extract: '' } },
        );
        expect(await wikipediaTool.run('empty', ctx(), { fetch: fetchMock as never })).toBeNull();
    });

    it('returns null on a transport error rather than throwing', async () => {
        const fetchMock = jest.fn().mockRejectedValue(new Error('ETIMEDOUT'));
        expect(await wikipediaTool.run('paris', ctx(), { fetch: fetchMock as never })).toBeNull();
    });

    it('returns null on a non-200', async () => {
        const fetchMock = fetchReturning({ status: 500, body: {} });
        expect(await wikipediaTool.run('paris', ctx(), { fetch: fetchMock as never })).toBeNull();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/tools/wikipedia.test.ts`
Expected: FAIL — `Cannot find module './wikipedia'`.

- [ ] **Step 3: Write `src/tools/wikipedia.ts`**

```ts
import { Tool, ToolAnswer, ToolContext } from './types';

const SEARCH_URL = 'https://en.wikipedia.org/w/api.php';
const SUMMARY_URL = 'https://en.wikipedia.org/api/rest_v1/page/summary';
const TIMEOUT_MS = 6000;
const MAX_BODY = 1200;

export interface WikipediaDeps {
    fetch?: typeof fetch;
}

async function getJson(url: string, doFetch: typeof fetch): Promise<any | null> {
    const response = await doFetch(url, {
        headers: { accept: 'application/json', 'user-agent': 'alia-bot (https://github.com/drobati/alia-bot)' },
        signal: AbortSignal.timeout(TIMEOUT_MS),
    });
    return response.ok ? await response.json() : null;
}

export const wikipediaTool: Tool = {
    name: 'wikipedia',

    async run(query: string, _ctx: ToolContext, deps: WikipediaDeps = {}): Promise<ToolAnswer | null> {
        const doFetch = deps.fetch ?? fetch;
        try {
            const searchUrl =
                `${SEARCH_URL}?action=query&list=search&format=json&srlimit=1&srsearch=${encodeURIComponent(query)}`;
            const search = await getJson(searchUrl, doFetch);
            const title = search?.query?.search?.[0]?.title;
            if (!title) {
                return null;
            }

            const summary = await getJson(`${SUMMARY_URL}/${encodeURIComponent(title)}`, doFetch);
            const extract: string | undefined = summary?.extract;
            if (!extract) {
                return null;
            }

            return {
                title: summary.title ?? title,
                body: extract.slice(0, MAX_BODY),
                url: summary?.content_urls?.desktop?.page,
                sourceLabel: 'Wikipedia',
            };
        } catch {
            // A lookup that cannot complete is a tool that cannot answer.
            return null;
        }
    },
};
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx jest src/tools/wikipedia.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/wikipedia.ts src/tools/wikipedia.test.ts
git commit -m "feat(questions): answer general knowledge from Wikipedia"
```

---

### Task 6: Extract the weather core, add the weather tool

`src/commands/weather.ts` keeps `geocodeLocation` and `getWeather` private. Move them so the slash command and the tool share one implementation.

**Files:**
- Create: `src/lib/weather-core.ts`
- Modify: `src/commands/weather.ts`
- Create: `src/tools/weather.ts`
- Test: `src/tools/weather.test.ts`

**Interfaces:**
- Consumes: `Tool`, `ToolAnswer`, `ToolContext`.
- Produces: `weather-core.ts` exporting `geocodeLocation(query, deps?)`, `getWeather(lat, lon, deps?)`, `GeocodingResult`, `WeatherResponse`; and `weatherTool: Tool` (`name: 'weather'`).

- [ ] **Step 1: Move the functions**

Cut `GeocodingResult`, `WeatherResponse`, `geocodeLocation`, `geocodeLocationMultiple`, `getWeather`, `getWeatherInfo`, `formatTemperature`, `getDayName` and `formatLocationName` out of `src/commands/weather.ts` into a new `src/lib/weather-core.ts`, exporting each. Add an optional `deps: { fetch?: typeof fetch } = {}` parameter to `geocodeLocation`, `geocodeLocationMultiple` and `getWeather`, defaulting to the global `fetch`, so tests can inject one. Change nothing else about their bodies.

In `src/commands/weather.ts`, delete those definitions and import them:

```ts
import {
    formatLocationName,
    formatTemperature,
    geocodeLocation,
    geocodeLocationMultiple,
    getDayName,
    getWeather,
    getWeatherInfo,
    type GeocodingResult,
    type WeatherResponse,
} from '../lib/weather-core';
```

- [ ] **Step 2: Verify the existing command tests still pass**

Run: `npx jest src/commands/weather.test.ts`
Expected: PASS, unchanged. This is what makes the extraction safe; if it fails, the move was not faithful.

- [ ] **Step 3: Write the failing tool test**

Create `src/tools/weather.test.ts`:

```ts
import { weatherTool } from './weather';
import { createContext } from '../utils/testHelpers';

jest.mock('../lib/weather-core', () => ({
    geocodeLocation: jest.fn(),
    getWeather: jest.fn(),
}));

import { geocodeLocation, getWeather } from '../lib/weather-core';

const ctx = () => ({ message: {} as never, context: createContext() as never });

describe('weatherTool', () => {
    beforeEach(() => jest.clearAllMocks());

    it('answers with the current conditions for the named place', async () => {
        (geocodeLocation as jest.Mock).mockResolvedValue({
            name: 'Tokyo', country: 'Japan', latitude: 35.6, longitude: 139.6,
        });
        (getWeather as jest.Mock).mockResolvedValue({
            current: { temperature_2m: 18.2, weather_code: 3 },
        });

        const answer = await weatherTool.run('is it gonna rain in tokyo tomorrow?', ctx());

        expect(answer?.sourceLabel).toBe('open-meteo');
        expect(answer?.title).toContain('Tokyo');
        expect(answer?.body).toContain('18');
    });

    it('returns null when the place cannot be geocoded', async () => {
        (geocodeLocation as jest.Mock).mockResolvedValue(null);
        expect(await weatherTool.run('weather in asdfqwer?', ctx())).toBeNull();
    });

    it('returns null when no place is named at all', async () => {
        expect(await weatherTool.run('is it gonna rain tomorrow?', ctx())).toBeNull();
        expect(geocodeLocation).not.toHaveBeenCalled();
    });

    it('returns null when the forecast lookup throws', async () => {
        (geocodeLocation as jest.Mock).mockResolvedValue({
            name: 'Tokyo', country: 'Japan', latitude: 35.6, longitude: 139.6,
        });
        (getWeather as jest.Mock).mockRejectedValue(new Error('down'));
        expect(await weatherTool.run('weather in tokyo?', ctx())).toBeNull();
    });
});
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npx jest src/tools/weather.test.ts`
Expected: FAIL — `Cannot find module './weather'`.

- [ ] **Step 5: Write `src/tools/weather.ts`**

```ts
import { geocodeLocation, getWeather, getWeatherInfo } from '../lib/weather-core';
import { Tool, ToolAnswer, ToolContext } from './types';

/**
 * Pulls a place out of the question. Without a place there is nothing to look
 * up, and guessing a default would answer confidently about the wrong city.
 */
export function extractLocation(query: string): string | null {
    const match = /\b(?:in|at|for)\s+([A-Za-z][A-Za-z\s.'-]{1,40})/i.exec(query);
    if (!match) {
        return null;
    }
    const place = match[1]
        .replace(/\b(today|tomorrow|tonight|now|right now|this week)\b/gi, '')
        .replace(/[?!.]+$/, '')
        .trim();
    return place.length >= 2 ? place : null;
}

export const weatherTool: Tool = {
    name: 'weather',

    async run(query: string, _ctx: ToolContext): Promise<ToolAnswer | null> {
        const place = extractLocation(query);
        if (!place) {
            return null;
        }

        try {
            const location = await geocodeLocation(place);
            if (!location) {
                return null;
            }

            const weather = await getWeather(location.latitude, location.longitude);
            const current = weather?.current;
            if (!current) {
                return null;
            }

            const info = getWeatherInfo(current.weather_code);
            return {
                title: `${info.emoji} ${location.name}, ${location.country}`,
                body: `${Math.round(current.temperature_2m)}°C, ${info.description}.`,
                sourceLabel: 'open-meteo',
            };
        } catch {
            return null;
        }
    },
};
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx jest src/tools/weather.test.ts src/commands/weather.test.ts`
Expected: PASS, both suites.

- [ ] **Step 7: Commit**

```bash
git add src/lib/weather-core.ts src/commands/weather.ts src/tools/weather.ts src/tools/weather.test.ts
git commit -m "feat(questions): share the weather lookup with a weather tool"
```

---

### Task 7: Extract the calc core, add the math tool

**Files:**
- Create: `src/lib/calc-core.ts`
- Modify: `src/commands/calc.ts`
- Create: `src/tools/math.ts`
- Test: `src/tools/math.test.ts`

**Interfaces:**
- Consumes: `Tool`, `ToolAnswer`, `ToolContext`.
- Produces: `calc-core.ts` exporting `evaluateExpression(expression) => string | null` and `formatResult(value) => string`; `mathTool: Tool` (`name: 'math'`).

- [ ] **Step 1: Move the evaluator**

Move the mathjs instance, `limitedEvaluate` and `formatResult` from `src/commands/calc.ts` into `src/lib/calc-core.ts`. Export `formatResult`, and add:

```ts
/** Evaluates an expression, returning null when mathjs cannot. */
export function evaluateExpression(expression: string): string | null {
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
```

In `src/commands/calc.ts`, import `formatResult` and `evaluateExpression` from `../lib/calc-core` and delete the moved definitions. Keep `getExamples` where it is; it is command help, not arithmetic.

- [ ] **Step 2: Verify the existing command tests still pass**

Run: `npx jest src/commands/calc.test.ts`
Expected: PASS, unchanged.

- [ ] **Step 3: Write the failing tool test**

Create `src/tools/math.test.ts`:

```ts
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
```

- [ ] **Step 4: Run it and watch it fail**

Run: `npx jest src/tools/math.test.ts`
Expected: FAIL — `Cannot find module './math'`.

- [ ] **Step 5: Write `src/tools/math.ts`**

```ts
import { evaluateExpression } from '../lib/calc-core';
import { Tool, ToolAnswer, ToolContext } from './types';

const LEAD_IN = /^\s*(?:what(?:'s| is)|whats|how much is|calculate|compute|work out)\s+/i;

/** Strips the question around the arithmetic. mathjs understands "15% of 240". */
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

export const mathTool: Tool = {
    name: 'math',

    async run(query: string, _ctx: ToolContext): Promise<ToolAnswer | null> {
        const expression = extractExpression(query);
        if (!expression) {
            return null;
        }

        const result = evaluateExpression(expression);
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
```

- [ ] **Step 6: Run the tests and watch them pass**

Run: `npx jest src/tools/math.test.ts src/commands/calc.test.ts`
Expected: PASS, both suites.

- [ ] **Step 7: Commit**

```bash
git add src/lib/calc-core.ts src/commands/calc.ts src/tools/math.ts src/tools/math.test.ts
git commit -m "feat(questions): share the calculator with a math tool"
```

---

### Task 8: Time and date tool

**Files:**
- Create: `src/tools/timeDate.ts`
- Test: `src/tools/timeDate.test.ts`

**Interfaces:**
- Consumes: `Tool`, `ToolAnswer`, `ToolContext`.
- Produces: `timeDateTool: Tool` (`name: 'time_date'`), `resolveTimeZone(query) => string | null`.

No API. `Intl.DateTimeFormat` already knows every IANA zone.

- [ ] **Step 1: Write the failing test**

Create `src/tools/timeDate.test.ts`:

```ts
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
});

describe('timeDateTool', () => {
    it('answers with the local time in the named zone', async () => {
        const answer = await timeDateTool.run('what time is it in tokyo?', ctx());
        expect(answer?.title).toContain('Tokyo');
        expect(answer?.body).toMatch(/\d{1,2}:\d{2}/);
        expect(answer?.sourceLabel).toBe('server clock');
    });

    it('returns null for an unknown place rather than answering about UTC', async () => {
        expect(await timeDateTool.run('what time is it in atlantis?', ctx())).toBeNull();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/tools/timeDate.test.ts`
Expected: FAIL — `Cannot find module './timeDate'`.

- [ ] **Step 3: Write `src/tools/timeDate.ts`**

```ts
import { Tool, ToolAnswer, ToolContext } from './types';

/**
 * Cities people actually ask about. A full tz database lookup is not worth the
 * dependency, and an unknown place returns null rather than a confident answer
 * about the wrong clock.
 */
const ZONES: Record<string, string> = {
    'tokyo': 'Asia/Tokyo',
    'japan': 'Asia/Tokyo',
    'new york': 'America/New_York',
    'nyc': 'America/New_York',
    'los angeles': 'America/Los_Angeles',
    'la': 'America/Los_Angeles',
    'chicago': 'America/Chicago',
    'denver': 'America/Denver',
    'london': 'Europe/London',
    'uk': 'Europe/London',
    'paris': 'Europe/Paris',
    'berlin': 'Europe/Berlin',
    'moscow': 'Europe/Moscow',
    'dubai': 'Asia/Dubai',
    'india': 'Asia/Kolkata',
    'sydney': 'Australia/Sydney',
    'utc': 'UTC',
};

export function resolveTimeZone(query: string): string | null {
    const match = /\bin\s+([a-z\s]{2,30})/i.exec(query.toLowerCase());
    if (!match) {
        return 'UTC';
    }
    const place = match[1].replace(/[?!.]+$/, '').trim();
    return ZONES[place] ?? null;
}

export const timeDateTool: Tool = {
    name: 'time_date',

    async run(query: string, _ctx: ToolContext): Promise<ToolAnswer | null> {
        const zone = resolveTimeZone(query);
        if (!zone) {
            return null;
        }

        try {
            const now = new Date();
            const time = new Intl.DateTimeFormat('en-GB', {
                timeZone: zone, hour: '2-digit', minute: '2-digit',
            }).format(now);
            const date = new Intl.DateTimeFormat('en-GB', {
                timeZone: zone, weekday: 'long', day: 'numeric', month: 'long',
            }).format(now);

            return {
                title: zone.split('/').pop()!.replace(/_/g, ' '),
                body: `${time} — ${date}`,
                sourceLabel: 'server clock',
            };
        } catch {
            return null;
        }
    },
};
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx jest src/tools/timeDate.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/timeDate.ts src/tools/timeDate.test.ts
git commit -m "feat(questions): answer time and date questions"
```

---

### Task 9: Server member tool

Answers "who is @derek?" from descriptions people already taught her.

**Files:**
- Create: `src/tools/serverMember.ts`
- Test: `src/tools/serverMember.test.ts`

**Interfaces:**
- Consumes: `Tool`, `ToolAnswer`, `ToolContext`.
- Produces: `serverMemberTool: Tool` (`name: 'server_member'`).

Reads `tables.UserDescriptions`, written by `src/responses/descriptions.ts` (columns `guild_id`, `user_id`, `description`, `creator_id`).

- [ ] **Step 1: Write the failing test**

Create `src/tools/serverMember.test.ts`:

```ts
import { serverMemberTool } from './serverMember';
import { createContext, createTable } from '../utils/testHelpers';

function ctx(mentionedId: string | null, descriptions: Array<{ description: string }>) {
    const context = createContext();
    const table = createTable();
    table.findAll.mockResolvedValue(descriptions);
    context.tables.UserDescriptions = table;

    const message = {
        guildId: 'g1',
        mentions: {
            users: {
                first: () => (mentionedId ? { id: mentionedId, username: 'derek' } : undefined),
            },
        },
    };
    return { toolCtx: { message: message as never, context: context as never }, table };
}

describe('serverMemberTool', () => {
    it('answers with the descriptions stored for the mentioned user', async () => {
        const { toolCtx } = ctx('u1', [{ description: 'runs the server' }, { description: 'plays dota badly' }]);

        const answer = await serverMemberTool.run('who is @derek?', toolCtx);

        expect(answer?.title).toContain('derek');
        expect(answer?.body).toContain('runs the server');
        expect(answer?.body).toContain('plays dota badly');
        expect(answer?.sourceLabel).toBe('what people told me');
    });

    it('returns null when nobody is mentioned, rather than guessing who is meant', async () => {
        const { toolCtx, table } = ctx(null, []);
        expect(await serverMemberTool.run('who is that guy?', toolCtx)).toBeNull();
        expect(table.findAll).not.toHaveBeenCalled();
    });

    it('returns null when the user has no descriptions yet', async () => {
        const { toolCtx } = ctx('u1', []);
        expect(await serverMemberTool.run('who is @derek?', toolCtx)).toBeNull();
    });

    it('returns null outside a guild', async () => {
        const context = createContext();
        context.tables.UserDescriptions = createTable();
        const message = { guildId: null, mentions: { users: { first: () => ({ id: 'u1', username: 'd' }) } } };
        expect(await serverMemberTool.run('who is @derek?',
            { message: message as never, context: context as never })).toBeNull();
    });

    it('returns null when the lookup throws', async () => {
        const { toolCtx, table } = ctx('u1', []);
        table.findAll.mockRejectedValue(new Error('db down'));
        expect(await serverMemberTool.run('who is @derek?', toolCtx)).toBeNull();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/tools/serverMember.test.ts`
Expected: FAIL — `Cannot find module './serverMember'`.

- [ ] **Step 3: Write `src/tools/serverMember.ts`**

```ts
import { Tool, ToolAnswer, ToolContext } from './types';

const MAX_DESCRIPTIONS = 5;

export const serverMemberTool: Tool = {
    name: 'server_member',

    async run(_query: string, ctx: ToolContext): Promise<ToolAnswer | null> {
        const { message, context } = ctx;
        if (!message.guildId) {
            return null;
        }

        // Only answers about someone actually mentioned. Resolving a bare name
        // would risk answering confidently about the wrong person.
        const target = message.mentions?.users?.first();
        if (!target) {
            return null;
        }

        try {
            const rows = await context.tables.UserDescriptions.findAll({
                where: { guild_id: message.guildId, user_id: target.id },
                limit: MAX_DESCRIPTIONS,
            });
            if (!rows || rows.length === 0) {
                return null;
            }

            return {
                title: target.username,
                body: rows.map((row: { description: string }) => `• ${row.description}`).join('\n'),
                sourceLabel: 'what people told me',
            };
        } catch {
            return null;
        }
    },
};
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx jest src/tools/serverMember.test.ts`
Expected: PASS, 5 tests.

- [ ] **Step 5: Commit**

```bash
git add src/tools/serverMember.ts src/tools/serverMember.test.ts
git commit -m "feat(questions): answer who someone is from stored descriptions"
```

---

### Task 10: Tool registry and the answer runner

Ties classification, routing, tools and the embed together. Both entry points use this.

**Files:**
- Create: `src/tools/index.ts`
- Create: `src/utils/answer-runner.ts`
- Test: `src/utils/answer-runner.test.ts`

**Interfaces:**
- Consumes: every tool from Tasks 5–9, `decide` (Task 1), `classify` (Task 2), `recordClassification` (Task 3), `buildAnswerEmbed` (Task 4).
- Produces: `TOOLS: Record<ToolName, Tool>`, and `answerQuestion(message, context, { content, addressedToBot }) => Promise<AnswerOutcome>` where `AnswerOutcome` is `{ kind: 'answered' } | { kind: 'llm' } | { kind: 'silent' }`.

`answerQuestion` sends the embed itself when it answers. `'llm'` tells the caller to run the existing LLM path.

- [ ] **Step 1: Write `src/tools/index.ts`**

```ts
import { ToolName } from '../utils/question-types';
import { mathTool } from './math';
import { serverMemberTool } from './serverMember';
import { timeDateTool } from './timeDate';
import { Tool } from './types';
import { weatherTool } from './weather';
import { wikipediaTool } from './wikipedia';

export const TOOLS: Record<ToolName, Tool> = {
    wikipedia: wikipediaTool,
    weather: weatherTool,
    math: mathTool,
    time_date: timeDateTool,
    server_member: serverMemberTool,
};
```

- [ ] **Step 2: Write the failing test**

Create `src/utils/answer-runner.test.ts`:

```ts
import { answerQuestion } from './answer-runner';
import { createContext, createTable } from './testHelpers';

jest.mock('./question-classifier', () => ({ classify: jest.fn() }));
jest.mock('../tools', () => ({ TOOLS: { wikipedia: { name: 'wikipedia', run: jest.fn() } } }));
// `weather` is added inside the test that needs it, so the registry mock stays small.

import { classify } from './question-classifier';
import { TOOLS } from '../tools';

function setup() {
    const context = createContext();
    context.tables.ClassificationLog = createTable();
    const send = jest.fn().mockResolvedValue(undefined);
    const reply = jest.fn().mockResolvedValue(undefined);
    const message = {
        id: 'm1', guildId: 'g1', channelId: 'c1',
        channel: { send },
        reply,
    };
    return { context, message, send, reply };
}

describe('answerQuestion', () => {
    beforeEach(() => jest.clearAllMocks());

    it('sends an embed when a confident tool answers', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.95, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockResolvedValue({
            title: 'Paris', body: 'Capital of France.', sourceLabel: 'Wikipedia',
        });
        const { context, message, reply, send } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'capital of France?', addressedToBot: false });

        expect(outcome).toEqual({ kind: 'answered' });
        // Passive answers reply to the message; they do not post loose into the channel.
        expect(reply).toHaveBeenCalledWith(expect.objectContaining({ embeds: expect.any(Array) }));
        expect(send).not.toHaveBeenCalled();
    });

    it('sends rather than replies when she was addressed', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'weather', confidence: 0.95, alternatives: [],
        });
        (TOOLS as Record<string, { run: jest.Mock }>).weather = {
            run: jest.fn().mockResolvedValue({ title: 'Tokyo', body: '18°C', sourceLabel: 'open-meteo' }),
        } as never;
        const { context, message, reply, send } = setup();

        await answerQuestion(message as never, context as never,
            { content: 'what is the weather in tokyo?', addressedToBot: true });

        expect(send).toHaveBeenCalled();
        expect(reply).not.toHaveBeenCalled();
    });

    it('asks the caller for the LLM when addressed and no tool applies', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'banter_insult', confidence: 0.99, alternatives: [],
        });
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'you smell', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
    });

    it('stays silent when not addressed and no tool applies', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'directed_at_human', confidence: 0.98, alternatives: [],
        });
        const { context, message, send } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'you coming tonight?', addressedToBot: false });

        expect(outcome).toEqual({ kind: 'silent' });
        expect(send).not.toHaveBeenCalled();
    });

    it('logs a below-floor classification', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.5,
            alternatives: [{ type: 'directed_at_human', p: 0.4 }],
        });
        const { context, message } = setup();

        await answerQuestion(message as never, context as never,
            { content: 'how do i get to the airport?', addressedToBot: false });

        expect(context.tables.ClassificationLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'below_floor', route: 'silent' }),
        );
    });

    it('logs separately when routing was right but the tool could not answer', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.97, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockResolvedValue(null);
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'asdfqwer?', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
        expect(context.tables.ClassificationLog.create).toHaveBeenCalledWith(
            expect.objectContaining({ reason: 'tool_no_answer' }),
        );
    });

    it('falls back to the LLM when the classifier fails and she was addressed', async () => {
        (classify as jest.Mock).mockResolvedValue(null);
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'anything', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
    });

    it('falls back to the LLM when sending the embed throws', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.95, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockResolvedValue({
            title: 'Paris', body: 'b', sourceLabel: 'Wikipedia',
        });
        const { context, message, send } = setup();
        send.mockRejectedValue(new Error('missing permissions'));

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'capital of France?', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
    });

    it('falls back to the LLM when the tool itself throws', async () => {
        (classify as jest.Mock).mockResolvedValue({
            type: 'general_knowledge', confidence: 0.95, alternatives: [],
        });
        (TOOLS.wikipedia.run as jest.Mock).mockRejectedValue(new Error('boom'));
        const { context, message } = setup();

        const outcome = await answerQuestion(message as never, context as never,
            { content: 'capital of France?', addressedToBot: true });

        expect(outcome).toEqual({ kind: 'llm' });
    });
});
```

- [ ] **Step 3: Run it and watch it fail**

Run: `npx jest src/utils/answer-runner.test.ts`
Expected: FAIL — `Cannot find module './answer-runner'`.

- [ ] **Step 4: Write `src/utils/answer-runner.ts`**

```ts
import { Message } from 'discord.js';
import { TOOLS } from '../tools';
import { buildAnswerEmbed } from './answer-embed';
import { recordClassification } from './classification-log';
import { classify } from './question-classifier';
import { decide } from './question-router';
import { Context } from './types';

export type AnswerOutcome =
    | { kind: 'answered' }
    | { kind: 'llm' }
    | { kind: 'silent' };

/**
 * The shared engine behind both entry points. Classifies, routes, and sends the
 * embed when a tool answers. `llm` means the caller should run the existing
 * assistant path; `silent` means say nothing.
 */
export async function answerQuestion(
    message: Message,
    context: Context,
    opts: { content: string; addressedToBot: boolean },
): Promise<AnswerOutcome> {
    const { addressedToBot, content } = opts;
    const fallback: AnswerOutcome = addressedToBot ? { kind: 'llm' } : { kind: 'silent' };

    const classification = await classify(content, { addressedToBot }, { log: context.log });
    const route = decide(classification, addressedToBot);

    const log = async (reason: 'below_floor' | 'tool_no_answer', routeLabel: string) => {
        if (!classification || !message.guildId) {
            return;
        }
        await recordClassification(context, {
            guildId: message.guildId,
            channelId: message.channelId,
            messageId: message.id,
            content,
            addressed: addressedToBot,
            classification,
            route: routeLabel,
            reason,
        });
    };

    if (route.kind !== 'tool') {
        await log('below_floor', route.kind);
        return fallback;
    }

    try {
        const answer = await TOOLS[route.tool].run(content, { message, context });
        if (!answer) {
            // Routing was right and the tool had nothing. A different problem
            // from a bad classification, and recorded as one.
            await log('tool_no_answer', `tool:${route.tool}`);
            return fallback;
        }

        const payload = { embeds: [buildAnswerEmbed(answer)] };
        if (addressedToBot) {
            const channel = message.channel as { send?: (p: unknown) => Promise<unknown> };
            if (typeof channel?.send !== 'function') {
                return fallback;
            }
            await channel.send(payload);
        } else {
            // A passive answer replies, so it is obvious which message it answers
            // in a channel where nobody addressed her.
            await message.reply(payload);
        }

        context.log.info('Answered with a tool', {
            tool: route.tool,
            type: classification?.type,
            addressed: addressedToBot,
        });
        return { kind: 'answered' };
    } catch (error) {
        context.log.error('Tool answer failed', { tool: route.tool, error });
        return fallback;
    }
}
```

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx jest src/utils/answer-runner.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 6: Commit**

```bash
git add src/tools/index.ts src/utils/answer-runner.ts src/utils/answer-runner.test.ts
git commit -m "feat(questions): tool registry and the shared answer runner"
```

---

### Task 11: Opted-in channel configuration

**Files:**
- Create: `src/utils/passive-channels.ts`
- Test: `src/utils/passive-channels.test.ts`

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: `isPassiveChannel(context, guildId, channelId) => Promise<boolean>`, `setPassiveChannel(context, guildId, channelId, enabled) => Promise<void>`, `clearPassiveChannelCache()`.

Uses `tables.Config`, key `passive_qa_channels_${guildId}`, value a JSON array of channel ids — following `security_purgatory_channel_${guildId}`.

- [ ] **Step 1: Write the failing test**

Create `src/utils/passive-channels.test.ts`:

```ts
import { isPassiveChannel, setPassiveChannel, clearPassiveChannelCache } from './passive-channels';
import { createContext, createTable } from './testHelpers';

function setup(value: string | null) {
    const context = createContext();
    const table = createTable();
    table.findOne.mockResolvedValue(value === null ? null : { key: 'k', value });
    context.tables.Config = table;
    return { context, table };
}

describe('isPassiveChannel', () => {
    beforeEach(() => clearPassiveChannelCache());

    it('is true for a channel in the list', async () => {
        const { context } = setup(JSON.stringify(['c1', 'c2']));
        expect(await isPassiveChannel(context as never, 'g1', 'c2')).toBe(true);
    });

    it('is false for a channel not in the list', async () => {
        const { context } = setup(JSON.stringify(['c1']));
        expect(await isPassiveChannel(context as never, 'g1', 'c9')).toBe(false);
    });

    it('is false when the guild has no config at all', async () => {
        const { context } = setup(null);
        expect(await isPassiveChannel(context as never, 'g1', 'c1')).toBe(false);
    });

    it('is false, not thrown, when the stored value is corrupt', async () => {
        const { context } = setup('not json');
        expect(await isPassiveChannel(context as never, 'g1', 'c1')).toBe(false);
    });

    it('reads the database once per guild while the cache is warm', async () => {
        const { context, table } = setup(JSON.stringify(['c1']));
        await isPassiveChannel(context as never, 'g1', 'c1');
        await isPassiveChannel(context as never, 'g1', 'c1');
        expect(table.findOne).toHaveBeenCalledTimes(1);
    });

    it('is false when the lookup throws', async () => {
        const { context, table } = setup(null);
        table.findOne.mockRejectedValue(new Error('db down'));
        expect(await isPassiveChannel(context as never, 'g1', 'c1')).toBe(false);
    });
});

describe('setPassiveChannel', () => {
    beforeEach(() => clearPassiveChannelCache());

    it('adds a channel and invalidates the cache', async () => {
        const { context, table } = setup(JSON.stringify(['c1']));
        await setPassiveChannel(context as never, 'g1', 'c2', true);

        expect(table.upsert).toHaveBeenCalledWith({
            key: 'passive_qa_channels_g1',
            value: JSON.stringify(['c1', 'c2']),
        });
    });

    it('removes a channel', async () => {
        const { context, table } = setup(JSON.stringify(['c1', 'c2']));
        await setPassiveChannel(context as never, 'g1', 'c1', false);

        expect(table.upsert).toHaveBeenCalledWith({
            key: 'passive_qa_channels_g1',
            value: JSON.stringify(['c2']),
        });
    });

    it('does not duplicate a channel already enabled', async () => {
        const { context, table } = setup(JSON.stringify(['c1']));
        await setPassiveChannel(context as never, 'g1', 'c1', true);

        expect(table.upsert).toHaveBeenCalledWith({
            key: 'passive_qa_channels_g1',
            value: JSON.stringify(['c1']),
        });
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/utils/passive-channels.test.ts`
Expected: FAIL — `Cannot find module './passive-channels'`.

- [ ] **Step 3: Write `src/utils/passive-channels.ts`**

```ts
import { Context } from './types';

const TTL_MS = 60_000;
/** Bounded on purpose. An unbounded per-guild cache is a slow leak. */
const MAX_GUILDS = 500;

interface Entry {
    channels: string[];
    expires: number;
}

const cache = new Map<string, Entry>();

const keyFor = (guildId: string) => `passive_qa_channels_${guildId}`;

export function clearPassiveChannelCache(): void {
    cache.clear();
}

function prune(now: number): void {
    for (const [guildId, entry] of cache) {
        if (entry.expires <= now) {
            cache.delete(guildId);
        }
    }
    while (cache.size > MAX_GUILDS) {
        const oldest = cache.keys().next().value as string | undefined;
        if (oldest === undefined) {
            break;
        }
        cache.delete(oldest);
    }
}

async function load(context: Context, guildId: string): Promise<string[]> {
    const now = Date.now();
    const cached = cache.get(guildId);
    if (cached && cached.expires > now) {
        return cached.channels;
    }

    let channels: string[] = [];
    try {
        const row = await context.tables.Config.findOne({ where: { key: keyFor(guildId) } });
        if (row?.value) {
            const parsed = JSON.parse(row.value);
            channels = Array.isArray(parsed) ? parsed.filter((c: unknown) => typeof c === 'string') : [];
        }
    } catch (error) {
        // A corrupt or unreachable config means passive answering is off, never on.
        context.log.warn('Failed to read passive channel config', { guildId, error });
        channels = [];
    }

    prune(now);
    cache.set(guildId, { channels, expires: now + TTL_MS });
    return channels;
}

export async function isPassiveChannel(
    context: Context,
    guildId: string,
    channelId: string,
): Promise<boolean> {
    return (await load(context, guildId)).includes(channelId);
}

export async function setPassiveChannel(
    context: Context,
    guildId: string,
    channelId: string,
    enabled: boolean,
): Promise<void> {
    const current = await load(context, guildId);
    const next = enabled
        ? (current.includes(channelId) ? current : [...current, channelId])
        : current.filter(id => id !== channelId);

    await context.tables.Config.upsert({ key: keyFor(guildId), value: JSON.stringify(next) });
    cache.delete(guildId);
}
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx jest src/utils/passive-channels.test.ts`
Expected: PASS, 9 tests.

- [ ] **Step 5: Commit**

```bash
git add src/utils/passive-channels.ts src/utils/passive-channels.test.ts
git commit -m "feat(questions): per-guild opt-in channels for passive answering"
```

---

### Task 12: The passive handler

**Files:**
- Create: `src/responses/questions.ts`
- Modify: `src/responses/index.ts`
- Modify: `events/messageCreate.ts`
- Test: `src/responses/questions.test.ts`

**Interfaces:**
- Consumes: `answerQuestion` (Task 10), `isPassiveChannel` (Task 11).
- Produces: a default export `(message, context) => Promise<boolean>`, plus `QUESTION_SUFFIX`, `MIN_PASSIVE_LENGTH`, `PASSIVE_COOLDOWN_MS`, `resetQuestionCooldowns()`.

- [ ] **Step 1: Write the failing test**

Create `src/responses/questions.test.ts`:

```ts
import questions, { resetQuestionCooldowns } from './questions';
import { createContext } from '../utils/testHelpers';

jest.mock('../utils/answer-runner', () => ({ answerQuestion: jest.fn() }));
jest.mock('../utils/passive-channels', () => ({ isPassiveChannel: jest.fn() }));

import { answerQuestion } from '../utils/answer-runner';
import { isPassiveChannel } from '../utils/passive-channels';

function messageOf(content: string, overrides: Record<string, unknown> = {}) {
    return {
        content,
        id: 'm1',
        guildId: 'g1',
        channelId: 'c1',
        author: { bot: false, id: 'u1' },
        channel: { send: jest.fn() },
        ...overrides,
    };
}

describe('questions (passive)', () => {
    beforeEach(() => {
        jest.clearAllMocks();
        resetQuestionCooldowns();
        (isPassiveChannel as jest.Mock).mockResolvedValue(true);
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'answered' });
    });

    it('handles a message ending in a question mark', async () => {
        expect(await questions(messageOf("what's the capital of France?") as never, createContext() as never))
            .toBe(true);
        expect(answerQuestion).toHaveBeenCalledWith(
            expect.anything(), expect.anything(),
            { content: "what's the capital of France?", addressedToBot: false },
        );
    });

    it.each(['huh?!', 'really!?', 'wait???'])('accepts trailing punctuation %s', async content => {
        await questions(messageOf(`something something ${content}`) as never, createContext() as never);
        expect(answerQuestion).toHaveBeenCalled();
    });

    it('ignores a message with no question mark', async () => {
        expect(await questions(messageOf('you smell') as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('ignores bots', async () => {
        const message = messageOf('what is it?', { author: { bot: true, id: 'b1' } });
        expect(await questions(message as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('ignores direct messages', async () => {
        const message = messageOf('what is it?', { guildId: null });
        expect(await questions(message as never, createContext() as never)).toBe(false);
    });

    it('does not classify in a channel nobody opted in', async () => {
        (isPassiveChannel as jest.Mock).mockResolvedValue(false);
        expect(await questions(messageOf('what is it?') as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('ignores a message too short to be a real question', async () => {
        expect(await questions(messageOf('ok?') as never, createContext() as never)).toBe(false);
        expect(answerQuestion).not.toHaveBeenCalled();
    });

    it('reports not-handled when the runner stays silent', async () => {
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'silent' });
        expect(await questions(messageOf('you coming tonight?') as never, createContext() as never))
            .toBe(false);
    });

    it('reports not-handled when the runner asks for the LLM, since passive never uses it', async () => {
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'llm' });
        expect(await questions(messageOf('what is anything?') as never, createContext() as never))
            .toBe(false);
    });

    it('applies a per-channel cooldown after answering', async () => {
        const context = createContext();
        await questions(messageOf('what is the first thing?') as never, context as never);
        await questions(messageOf('what is the second thing?') as never, context as never);
        expect(answerQuestion).toHaveBeenCalledTimes(1);
    });

    it('does not start the cooldown when it did not answer', async () => {
        (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'silent' });
        const context = createContext();
        await questions(messageOf('what is the first thing?') as never, context as never);
        await questions(messageOf('what is the second thing?') as never, context as never);
        expect(answerQuestion).toHaveBeenCalledTimes(2);
    });

    it('returns false when the runner throws', async () => {
        (answerQuestion as jest.Mock).mockRejectedValue(new Error('boom'));
        const context = createContext();
        expect(await questions(messageOf('what is it really?') as never, context as never)).toBe(false);
        expect(context.log.error).toHaveBeenCalled();
    });
});
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/responses/questions.test.ts`
Expected: FAIL — `Cannot find module './questions'`.

- [ ] **Step 3: Write `src/responses/questions.ts`**

```ts
import { Message } from 'discord.js';
import { answerQuestion } from '../utils/answer-runner';
import { isPassiveChannel } from '../utils/passive-channels';
import { Context } from '../utils/types';

/** Trailing punctuation containing a question mark: `?`, `?!`, `!?`, `???`. */
export const QUESTION_SUFFIX = /[?!]*\?[?!]*\s*$/;
export const MIN_PASSIVE_LENGTH = 8;
export const PASSIVE_COOLDOWN_MS = 5 * 60 * 1000;

const cooldowns = new Map<string, number>();

export function resetQuestionCooldowns(): void {
    cooldowns.clear();
}

function onCooldown(channelId: string, now: number): boolean {
    const last = cooldowns.get(channelId);
    if (last !== undefined && now - last < PASSIVE_COOLDOWN_MS) {
        return true;
    }
    // Bounded: drop entries that have expired rather than keeping one per channel forever.
    for (const [id, at] of cooldowns) {
        if (now - at >= PASSIVE_COOLDOWN_MS) {
            cooldowns.delete(id);
        }
    }
    return false;
}

/**
 * Answers questions asked without mentioning Alia, in channels an administrator
 * opted in. Gates run cheapest first so a busy channel nobody opted in costs
 * nothing: Jev is the last thing reached.
 */
export default async (message: Message, context: Context): Promise<boolean> => {
    if (message.author.bot || !message.guildId) {
        return false;
    }

    const content = message.content.trim();
    if (!QUESTION_SUFFIX.test(content) || content.length < MIN_PASSIVE_LENGTH) {
        return false;
    }

    if (!(await isPassiveChannel(context, message.guildId, message.channelId))) {
        return false;
    }

    const now = Date.now();
    if (onCooldown(message.channelId, now)) {
        return false;
    }

    try {
        const outcome = await answerQuestion(message, context, { content, addressedToBot: false });
        if (outcome.kind === 'answered') {
            // Only a real answer starts the cooldown; silence should not mute the channel.
            cooldowns.set(message.channelId, now);
            return true;
        }
        return false;
    } catch (error) {
        context.log.error('Passive question handling failed', { error, messageId: message.id });
        return false;
    }
};
```

- [ ] **Step 4: Register and wire it**

In `src/responses/index.ts`, add `import Questions from "./questions";` and `Questions,` to the exported object.

In `events/messageCreate.ts`, add a block immediately after the Assistant block and before the next handler, matching the surrounding style:

```ts
            // 2.5. Passive questions (opted-in channels, no mention needed)
            if (!responseHandled) {
                try {
                    const questionsResult = await response.Questions(message, context);
                    if (questionsResult === true) {
                        responseHandled = true;
                        context.log.debug('Message handled by Questions', {
                            messageId: message.id,
                            userId: message.author.id,
                        });
                    }
                } catch (error) {
                    context.log.error('Questions response failed', { error });
                }
            }
```

Also update the priority comment near the top of the handler to read:
`// Priority order: Password > D&D > Descriptions > Assistant (NLP) > Questions > Triggers > Adlibs > Louds`

- [ ] **Step 5: Run the tests and watch them pass**

Run: `npx jest src/responses/questions.test.ts events/messageCreate.test.ts`
Expected: PASS both. `messageCreate.test.ts` must still pass unchanged.

- [ ] **Step 6: Commit**

```bash
git add src/responses/questions.ts src/responses/questions.test.ts src/responses/index.ts events/messageCreate.ts
git commit -m "feat(questions): answer questions in opted-in channels without a mention"
```

---

### Task 13: Classify on the mentioned path

**Files:**
- Modify: `src/responses/assistant.ts`
- Test: `src/responses/assistant.test.ts`

**Interfaces:**
- Consumes: `answerQuestion` (Task 10).
- Produces: no new exports.

`assistant.ts` keeps its trigger and its whole LLM path. The only change: classify first, and return early when a tool answered.

- [ ] **Step 1: Write the failing test**

Append to `src/responses/assistant.test.ts`. The suite already builds
`mockMessage`, `mockContext` and `mockGenerateResponse` in its `beforeEach`, and
turns a mention on with `(mockMessage.mentions!.has as jest.Mock).mockReturnValue(true)`.
Reuse all of that; do not build a second fixture.

At the top of the file, beside the other `jest.mock` calls:

```ts
jest.mock('../utils/answer-runner', () => ({ answerQuestion: jest.fn() }));
```

and with the other imports:

```ts
import { answerQuestion } from '../utils/answer-runner';
```

Then add this block inside the outer `describe('Assistant Response System')`:

```ts
    describe('classification', () => {
        beforeEach(() => {
            (mockMessage.mentions!.has as jest.Mock).mockReturnValue(true);
            (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'llm' });
        });

        it('lets a tool answer and never reaches the LLM', async () => {
            mockMessage.content = '@Alia what is the weather in tokyo?';
            (answerQuestion as jest.Mock).mockResolvedValue({ kind: 'answered' });

            const result = await assistantResponse(mockMessage as Message, mockContext);

            expect(result).toBe(true);
            expect(mockGenerateResponse).not.toHaveBeenCalled();
        });

        it('runs the LLM when the runner asks for it', async () => {
            mockMessage.content = '@Alia you smell';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockGenerateResponse).toHaveBeenCalled();
        });

        it('classifies with addressedToBot true', async () => {
            mockMessage.content = '@Alia you smell';

            await assistantResponse(mockMessage as Message, mockContext);

            expect(answerQuestion).toHaveBeenCalledWith(
                expect.anything(),
                expect.anything(),
                expect.objectContaining({ addressedToBot: true }),
            );
        });

        it('still runs the LLM when the classifier throws', async () => {
            mockMessage.content = '@Alia hello there';
            (answerQuestion as jest.Mock).mockRejectedValue(new Error('classifier down'));

            await assistantResponse(mockMessage as Message, mockContext);

            expect(mockGenerateResponse).toHaveBeenCalled();
        });
    });
```

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/responses/assistant.test.ts`
Expected: FAIL — the new cases fail because `answerQuestion` is never called.

- [ ] **Step 3: Modify `src/responses/assistant.ts`**

Add the import:

```ts
import { answerQuestion } from '../utils/answer-runner';
```

Then, immediately after the `processableContent.length < MIN_CONTENT_LENGTH` guard and before `const startTime = Date.now();`, insert:

```ts
    // Classify before generating. A confident tool type is answered from a real
    // source; everything else, including a classifier failure, carries on to the
    // LLM below exactly as before.
    try {
        const outcome = await answerQuestion(message, context, {
            content: processableContent,
            addressedToBot: true,
        });
        if (outcome.kind === 'answered') {
            return true;
        }
    } catch (error) {
        context.log.error('Classification failed on the mentioned path; using the LLM', { error });
    }
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx jest src/responses/assistant.test.ts`
Expected: PASS, including every pre-existing case.

- [ ] **Step 5: Commit**

```bash
git add src/responses/assistant.ts src/responses/assistant.test.ts
git commit -m "feat(questions): classify mentioned messages before generating"
```

---

### Task 14: Regression corpus

The 27 messages from the spec, as offline fixtures. Guards the routing rule against taxonomy edits.

**Files:**
- Create: `src/utils/__fixtures__/classification-corpus.json`
- Test: `src/utils/question-corpus.test.ts`

**Interfaces:**
- Consumes: `decide` (Task 1), `Classification` (Task 1).
- Produces: nothing.

- [ ] **Step 1: Write the fixture**

Create `src/utils/__fixtures__/classification-corpus.json`. These are recorded verdicts from the live model, and they are replayed, never re-fetched:

```json
[
  { "message": "What's the capital of France?", "addressed": true,  "type": "general_knowledge", "confidence": 0.92, "expected": "tool:wikipedia" },
  { "message": "how tall is mount everest?",    "addressed": false, "type": "general_knowledge", "confidence": 0.96, "expected": "tool:wikipedia" },
  { "message": "is it gonna rain tomorrow?",    "addressed": false, "type": "weather",           "confidence": 0.95, "expected": "tool:weather" },
  { "message": "what is the weather?",          "addressed": true,  "type": "weather",           "confidence": 1.0,  "expected": "tool:weather" },
  { "message": "whats 15% of 240?",             "addressed": false, "type": "math",              "confidence": 0.97, "expected": "tool:math" },
  { "message": "what time is it in tokyo?",     "addressed": false, "type": "time_date",         "confidence": 0.99, "expected": "tool:time_date" },
  { "message": "who is @derek?",                "addressed": false, "type": "server_member",     "confidence": 0.95, "expected": "tool:server_member" },
  { "message": "did the fed cut rates this week?", "addressed": false, "type": "current_events", "confidence": 0.97, "expected": "silent" },
  { "message": "what's AAPL trading at?",       "addressed": false, "type": "finance",           "confidence": 0.99, "expected": "silent" },
  { "message": "you coming tonight?",           "addressed": false, "type": "directed_at_human", "confidence": 0.96, "expected": "silent" },
  { "message": "anyone wanna queue?",           "addressed": false, "type": "directed_at_human", "confidence": 0.99, "expected": "silent" },
  { "message": "can someone help me with this bug?", "addressed": false, "type": "directed_at_human", "confidence": 0.98, "expected": "silent" },
  { "message": "u good?",                       "addressed": false, "type": "directed_at_human", "confidence": 0.97, "expected": "silent" },
  { "message": "is dota better than lol?",      "addressed": false, "type": "opinion",           "confidence": 0.91, "expected": "silent" },
  { "message": "should I buy the new gpu?",     "addressed": false, "type": "opinion",           "confidence": 0.71, "expected": "silent" },
  { "message": "anyone else think this patch is garbage?", "addressed": false, "type": "opinion", "confidence": 0.51, "expected": "silent" },
  { "message": "why does this always happen to me?", "addressed": false, "type": "venting",      "confidence": 0.83, "expected": "silent" },
  { "message": "wait what?",                    "addressed": false, "type": "directed_at_human", "confidence": 0.57, "expected": "silent" },
  { "message": "how do i get to the airport from here?", "addressed": false, "type": "directed_at_human", "confidence": 0.72, "expected": "silent" },
  { "message": "what can you do?",              "addressed": false, "type": "bot_capability",    "confidence": 0.84, "expected": "silent" },
  { "message": "you smell",                     "addressed": true,  "type": "banter_insult",     "confidence": 0.99, "expected": "llm" },
  { "message": "i think you're broken",         "addressed": true,  "type": "banter_insult",     "confidence": 0.79, "expected": "llm" },
  { "message": "are you a thick goth mommy?",   "addressed": true,  "type": "about_alia",        "confidence": 0.52, "expected": "llm" },
  { "message": "do you even have feelings?",    "addressed": true,  "type": "about_alia",        "confidence": 0.96, "expected": "llm" },
  { "message": "thanks alia you're the best",   "addressed": true,  "type": "compliment",        "confidence": 1.0,  "expected": "llm" },
  { "message": "tell me a joke",                "addressed": true,  "type": "request_action",    "confidence": 1.0,  "expected": "llm" },
  { "message": "roast derek for me",            "addressed": true,  "type": "request_action",    "confidence": 0.99, "expected": "llm" }
]
```

- [ ] **Step 2: Write the test**

Create `src/utils/question-corpus.test.ts`:

```ts
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
```

- [ ] **Step 3: Run the tests**

Run: `npx jest src/utils/question-corpus.test.ts`
Expected: PASS, 28 tests.

- [ ] **Step 4: Commit**

```bash
git add src/utils/__fixtures__/classification-corpus.json src/utils/question-corpus.test.ts
git commit -m "test(questions): offline regression corpus for the routing rule"
```

---

### Task 15: Prune the log, and full verification

**Files:**
- Modify: `src/services/schedulerService.ts`
- Test: `src/services/schedulerService.test.ts`

**Interfaces:**
- Consumes: `pruneClassificationLog` (Task 3).
- Produces: nothing.

- [ ] **Step 1: Write the failing test**

Add to `src/services/schedulerService.test.ts`:

```ts
jest.mock('../utils/classification-log', () => ({ pruneClassificationLog: jest.fn() }));
import { pruneClassificationLog } from '../utils/classification-log';

describe('classification log retention', () => {
    it('prunes rows older than 30 days on each poll', async () => {
        (pruneClassificationLog as jest.Mock).mockResolvedValue(3);

        await service.pruneClassificationLogs();

        expect(pruneClassificationLog).toHaveBeenCalledWith(expect.anything(), 30);
    });

    it('does not let a failed prune throw into the poll', async () => {
        (pruneClassificationLog as jest.Mock).mockRejectedValue(new Error('db down'));

        await expect(service.pruneClassificationLogs()).resolves.toBeUndefined();
    });
});
```

`service` is the `SchedulerService` the suite already builds in its `beforeEach`
with `new SchedulerService(mockClient, mockContext)` — two arguments, a client
and a context. Reuse it; do not construct a second one.

- [ ] **Step 2: Run it and watch it fail**

Run: `npx jest src/services/schedulerService.test.ts`
Expected: FAIL — `pruneClassificationLogs is not a function`.

- [ ] **Step 3: Add the method and call it**

In `src/services/schedulerService.ts`, import:

```ts
import { pruneClassificationLog } from '../utils/classification-log';
```

Add a constant beside the other module constants:

```ts
const CLASSIFICATION_LOG_RETENTION_DAYS = 30;
```

Add the method to the class:

```ts
    /**
     * A log table on a busy server grows without limit unless something removes
     * the old rows. Failures are logged and swallowed: retention must never take
     * the scheduler down.
     */
    async pruneClassificationLogs(): Promise<void> {
        try {
            const removed = await pruneClassificationLog(this.context, CLASSIFICATION_LOG_RETENTION_DAYS);
            if (removed > 0) {
                this.context.log.info('Pruned classification logs', { removed });
            }
        } catch (error) {
            this.context.log.warn('Classification log prune failed', { error });
        }
    }
```

Call it inside the existing `setInterval` callback in `startPolling`, after the existing work, wrapped so it cannot interrupt the rest:

```ts
            await this.pruneClassificationLogs();
```

- [ ] **Step 4: Run the tests and watch them pass**

Run: `npx jest src/services/schedulerService.test.ts`
Expected: PASS, including every pre-existing case.

- [ ] **Step 5: Run the whole suite and compare against the baseline**

```bash
npm test 2>&1 | tail -20
npx eslint src/tools src/utils src/responses/questions.ts src/lib
npx tsc --noEmit
```

Expected: the only failing suites are the 12 that already fail on `master`. Every new suite passes. `eslint` clean. `tsc` reports only the pre-existing missing `yahoo-finance2` in `src/utils/polygon-service.ts`.

If any suite fails that is not on the baseline list, stop and fix it before committing.

- [ ] **Step 6: Commit**

```bash
git add src/services/schedulerService.ts src/services/schedulerService.test.ts
git commit -m "feat(questions): prune classification logs after 30 days"
```

---

## Deferred to a follow-up

Not in this plan, and deliberately so:

- `current_events` and `finance` tools. Both classify well (0.97 and 0.99) but need a paid search key and the stock/coinbase clients. The taxonomy already carries the types, so adding them is a tool plus one line in `TOOL_FOR`.
- A slash command to opt a channel in. `setPassiveChannel` exists and is tested; until a command wraps it, a channel is enabled by inserting the `Config` row directly. Task 11 is what makes that safe to do by hand.
- An export script turning `ClassificationLog` rows into corpus fixtures.
- Catching confident mistakes. The log records what the floor rejected; a message routed to a tool at 0.98 that should not have been leaves no trace. That needs a way for people to flag a bad answer.
