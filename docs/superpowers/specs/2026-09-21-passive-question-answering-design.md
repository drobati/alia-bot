# Passive question answering with Jev classification

Date: 2026-09-21
Status: approved, not yet implemented

## Problem

Alia only answers when addressed. Every reply goes to one LLM call, so
"what is the capital of France?" and "you smell" get the same treatment: a
Grok completion coloured by the day's mood. Factual questions get a
personality answer with no source, and a question asked in open chat gets
nothing at all unless someone remembers to mention her.

Two things are missing. Alia cannot tell what kind of message she is
looking at, and she cannot answer without being spoken to first.

## Goals

- Classify every message Alia handles, mentioned or not, into one of a
  fixed set of kinds.
- Answer factual questions from a real source and cite it.
- Answer questions in opted-in channels with no mention.
- Keep her personality for everything that is not a lookup.
- Stay quiet in the cases that would make her annoying.

## Non-goals

- Replacing the LLM path. It remains the default for anything not a lookup.
- Answering in channels nobody opted in.
- Multi-turn tool use, tool chaining, or function-calling through the LLM.
- Changing how memories, moods or relationships work.

## Architecture

One classifier, two policies.

Jev classifies the message. A pure function decides what to do with the
result. The only difference between a mentioned message and a passive one
is what happens when no tool applies.

```
classify(content, { addressedToBot })  ->  { type, confidence }

const useTool = TOOL_FOR[type] && confidence >= CONFIDENCE_FLOOR

mentioned  ->  useTool ? tool(embed) : llm(mood + memories)
passive    ->  useTool ? tool(embed) : silence
```

One predicate, two fallbacks. Low-confidence classification can never
reach a tool. On the mentioned path the worst case of a bad
classification is the behaviour Alia has today.

### Why confidence only gates tools

On the mentioned path the LLM is the default, not a last resort. Alia
needs no confidence at all to answer in character; she needs confidence
only to *divert* a message away from herself and into a lookup. So the
floor guards one direction.

This is what makes a weak classification safe. `@alia are you a thick
goth mommy?` classifies as `about_alia` at 0.52. That is a poor score,
and it does not matter: `about_alia` is not a tool type, so the message
goes to the LLM, which is where it belonged.

## Taxonomy

Tool types divert to a lookup when confident.

| Type | Tool | Phase | Reuses |
| --- | --- | --- | --- |
| `general_knowledge` | Wikipedia REST | 1 | new, no key |
| `weather` | open-meteo | 1 | `commands/weather.ts` |
| `math` | mathjs | 1 | `commands/calc.ts` |
| `time_date` | `Intl` time zones | 1 | new, small |
| `server_member` | descriptions + memories | 1 | `UserDescriptions`, `Memories` |
| `current_events` | web search | 2 | new, paid key |
| `finance` | stock / crypto | 2 | `commands/stock.ts`, `coinbase.ts` |

LLM types go to the LLM when mentioned and to silence when passive:
`about_alia`, `banter_insult`, `compliment`, `statement_to_alia`,
`request_action`, `bot_capability`, `opinion`, `rhetorical`, `venting`,
`directed_at_human`.

`bot_capability` is an LLM type rather than a tool, for a measured
reason recorded below. The LLM already lists every slash command in its
system prompt, so it answers "what can you do?" well without a tool.

`directed_at_human` is the most important entry in that list. Most
questions in a Discord channel are aimed at other people, and answering
them is what makes a bot insufferable.

`CONFIDENCE_FLOOR` is 0.90, one exported constant.

### Evidence

Twenty-seven messages were classified against the live model
(`typesafe/jev-1.13` through OpenRouter) using the exact taxonomy above.
`@` marks a message treated as addressed to the bot.

| | Message | Type | Conf | Route |
| --- | --- | --- | --- | --- |
| @ | What's the capital of France? | `general_knowledge` | 1.00 | tool |
| | how tall is mount everest? | `general_knowledge` | 0.96 | tool |
| | is it gonna rain tomorrow? | `weather` | 0.95 | tool |
| @ | what is the weather? | `weather` | 1.00 | tool |
| | whats 15% of 240? | `math` | 0.97 | tool |
| | what time is it in tokyo? | `time_date` | 0.99 | tool |
| | who is @derek? | `server_member` | 0.95 | tool |
| | did the fed cut rates this week? | `current_events` | 0.97 | tool (phase 2) |
| | what's AAPL trading at? | `finance` | 0.99 | tool (phase 2) |
| | you coming tonight? | `directed_at_human` | 0.96 | silent |
| | anyone wanna queue? | `directed_at_human` | 0.99 | silent |
| | can someone help me with this bug? | `directed_at_human` | 0.98 | silent |
| | u good? | `directed_at_human` | 0.97 | silent |
| | is dota better than lol? | `opinion` | 0.91 | silent |
| | should I buy the new gpu? | `opinion` | 0.71 | silent |
| | anyone else think this patch is garbage? | `opinion` | 0.51 | silent |
| | why does this always happen to me? | `venting` | 0.83 | silent |
| | wait what? | `directed_at_human` | 0.57 | silent |
| | how do i get to the airport from here? | `directed_at_human` | 0.72 | silent |
| @ | you smell | `banter_insult` | 0.99 | LLM |
| @ | i think you're broken | `banter_insult` | 0.79 | LLM |
| @ | are you a thick goth mommy? | `about_alia` | 0.52 | LLM |
| @ | do you even have feelings? | `about_alia` | 0.96 | LLM |
| @ | thanks alia you're the best | `compliment` | 1.00 | LLM |
| @ | tell me a joke | `request_action` | 1.00 | LLM |
| @ | roast derek for me | `request_action` | 0.99 | LLM |
| | what can you do? | `bot_capability` | 0.84 | silent |

Every route is the intended one. Each tool type clears the floor; every
message that should not reach a tool falls below it or classifies as a
non-tool type.

Note `are you a thick goth mommy?` at 0.52. A weak score on the mentioned
path is harmless, because the LLM is the default and the floor only
prevents diversion into a tool.

### Criteria wording is part of the design

An earlier draft of this taxonomy scored `what time is it in tokyo?` at
0.61 as `general_knowledge`, because it had no `time_date` type. Adding
the type moved the same message to 0.99. Confidence reported a gap in the
taxonomy rather than a confident mistake.

The reverse also happens. `what can you do?` scored 0.97 against a small
taxonomy and 0.63 against the full one, because `bot_capability`,
`about_alia` and `request_action` compete for it. Sharpening the criteria
strings recovered it to 0.84 and lifted `request_action` from 0.79 to
0.99, but `bot_capability` never cleared 0.90.

Two consequences, both load-bearing:

1. `bot_capability` is not a tool type. It overlaps its neighbours by
   nature, and the LLM already answers it from `COMMANDS_BLOCK`. Rather
   than lower the floor or add a per-type threshold, the type routes to
   the LLM and the tool is dropped. One less tool, one less knob.

2. **The criteria strings are a tuned artifact, not documentation.**
   Adding a type, or rewording one, shifts confidence across every other
   type. Any change to the taxonomy requires re-running the corpus and
   regenerating the fixtures. A type whose members cannot clear the floor
   is not a tool type.

## Modules

```
src/utils/question-classifier.ts   Jev over OpenRouter; injectable fetch
src/utils/question-router.ts       decide(); pure, no I/O
src/utils/answer-embed.ts          buildAnswerEmbed(); one place
src/tools/types.ts                 Tool contract
src/tools/{wikipedia,weather,math,timeDate,serverMember}.ts
src/lib/weather-core.ts            extracted from commands/weather.ts
src/lib/calc-core.ts               extracted from commands/calc.ts
src/responses/questions.ts         passive handler
src/responses/assistant.ts         modified: classify before generating
```

`question-router.ts` holds no I/O on purpose. Every combination of type,
confidence and addressing is testable without a network, a database or a
Discord client, and that is where the logic worth trusting lives.

### Tool contract

```ts
interface ToolAnswer {
    title: string;
    body: string;
    url?: string;
    sourceLabel: string;   // "Wikipedia", "open-meteo"
}

interface Tool {
    name: string;
    run(query: string, ctx: ToolContext): Promise<ToolAnswer | null>;
}
```

`null` means the tool cannot answer: no Wikipedia article, a geocode
miss, an unparseable expression. It is not an error and is not logged as
one.

`null` reuses the policy already defined. On the mentioned path it falls
to the LLM; on the passive path it falls to silence. Without this a
Wikipedia miss on an `@alia` message would leave her silent when she was
spoken to directly.

Every tool answer is rendered by `buildAnswerEmbed`, so the source is
cited the same way everywhere and no tool invents its own layout.

### Shared cores

`commands/weather.ts` keeps `geocodeLocation` and `getWeather` private,
and `commands/calc.ts` keeps `limitedEvaluate` and `formatResult`
private. Both move to `src/lib/`, and the slash command and the tool call
the same code. No behaviour changes, and the existing command tests
cover the extraction.

## Data flow

### Mentioned

Unchanged up to the point of generation.

1. `assistant.ts` matches a mention or an `alia,` prefix, as today.
2. Classify the content, with `addressedToBot: true`.
3. Confident tool type: run the tool, send the embed, record history, done.
4. Otherwise, or on a `null` tool answer: today's path exactly, including
   mood, memories, `<REMEMBER/>` markers and `bumpInteraction`.

A question mark is not required here. `you smell` is a statement and
still classifies.

### Passive

`src/responses/questions.ts`, placed in the `messageCreate` chain
immediately after `Assistant`, so it can never take a message that
Password, D&D, Descriptions or Assistant wanted.

Gates run cheapest first, and Jev runs last:

1. not a bot, in a guild
2. trailing punctuation contains `?` — `/[?!]*\?[?!]*\s*$/`, which
   accepts `?`, `?!`, `!?` and `???`
3. channel is opted in
4. minimum length, and a per-channel cooldown
5. classify
6. route; anything that is not a confident tool type ends here in silence

A busy channel that nobody opted in costs zero Jev calls and one cached
lookup per message.

## Configuration

`tables.Config`, key `passive_qa_channels_${guildId}`, holding a JSON
array of channel ids. This follows the existing convention
(`security_purgatory_channel_${guildId}`) and reads in one query.

Reads go through a TTL cache keyed by guild. The cache is bounded and
prunes on write. Three never-pruned cooldown maps already exist in this
repository; this design does not add a fourth.

The model id is an environment variable defaulting to
`typesafe/jev-1.13`. `assistant.ts` hardcodes `x-ai/grok-4.3` today, and
that is the reason Alia went silent when OpenRouter retired the model
before it. A classifier is not worth a second outage of the same kind.

Credentials reuse `OPENROUTER_API_KEY`, already used by `utils/assistant.ts`.

## Failure handling

| Failure | Mentioned | Passive |
| --- | --- | --- |
| Jev unreachable or errors | log at `error`, fall through to LLM | log, stay silent |
| Classification below floor | LLM | silent |
| Tool returns `null` | LLM | silent |
| Tool throws | log at `error`, fall back to LLM | log, stay silent |
| Discord send fails | existing `safelySendToChannel` handling | same |

The rule behind the table: a classifier failure must never make Alia
silent toward someone who spoke to her directly. Degrade to the
behaviour she has today and say so in the log.

Failures are never reported as successful answers, and a tool that
cannot answer is distinguished in logs from a tool that broke.

## Cost and latency

A classification is roughly 300 input tokens, about $0.000013 at
$0.042/M. A thousand classified messages cost about one and a half cents.

Passive cost is bounded by opted-in channel traffic and by the cooldown.
The mentioned path gains one classification per message, which is
negligible beside the LLM call it precedes.

Latency on the mentioned path grows by one round trip, under a second in
the probes. Tool answers are faster overall than the LLM they replace.

## Testing

- `decide()`: exhaustive unit tests over type, confidence and addressing.
  No network.
- Classifier: injected fetch against recorded Jev payloads, including a
  malformed response and a non-200.
- Each tool: injected fetch, covering a hit, a miss returning `null`, and
  a transport error.
- Handlers: `createContext` and `createTable`, matching the existing
  suite.
- Regression corpus: the 27 messages above, with their recorded verdicts
  as fixtures, asserting the route rather than the wording. Runs offline.
- Extraction of the weather and calc cores is covered by the existing
  command tests.

Live Jev calls stay out of CI.

## Phasing

Phase 1 is the spine plus the five tools that need no new dependency:
Wikipedia, weather, math, time and server member. Weather and math
already exist in the repository; Wikipedia and time need no key.

Phase 2 adds `current_events` and `finance`, which need a paid search
key and reuse of the stock and coinbase clients.

The interesting risk is in detection, classification and routing, not in
any one tool. Phase 1 proves the spine in a real channel before the
taxonomy grows.

## Decisions

- Passive cooldown is five minutes per channel, matching `tips.ts` and
  `reactions.ts`. It is a constant beside `CONFIDENCE_FLOOR`.
- Minimum passive content length is 8 characters, which drops `?`, `wat?`
  and similar without reaching Jev.
- A passive answer uses a Discord reply, so it is clear which message it
  answers in a busy channel. Mentioned answers send as they do today.
- `opinion` reaches the LLM when mentioned, since it is not a tool type.

## Known gaps

- Directions and navigation have no type and no tool. They classify as
  something adjacent with low confidence and stay quiet, which is the
  intended degradation.
- `server_member` clears the floor at 0.95, the narrowest margin of any
  phase 1 tool. It deserves the most fixtures.
- The corpus is 27 messages chosen by hand. It demonstrates the routing
  rule; it does not measure precision or recall on real server traffic.
  The first weeks of logs should be sampled before the floor is tuned.
