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
classify(content, { addressedToBot })  ->  { type, confidence, alternatives }

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

`CONFIDENCE_FLOOR` is 0.85, one exported constant. The value is
measured rather than chosen; see below.

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

These are single observations. The next section is why that matters.

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
0.99. Repeat runs put `bot_capability` at 0.84 and 0.75 — straddling the
floor from below, inside the noise band measured in the next section. A
type that lands on the threshold is a type that answers intermittently.

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

### Confidence is not deterministic

The same message classified six times, with identical criteria, does not
return the same confidence:

| Message | Type across 6 runs | Confidence | Spread |
| --- | --- | --- | --- |
| What's the capital of France? | `general_knowledge`, always | 0.89 – 0.92 | 0.03 |
| is it gonna rain tomorrow? | `weather`, always | 0.92 – 0.96 | 0.04 |
| who is @derek? | `server_member`, always | 0.96 – 0.97 | 0.01 |

The **type is stable** for a clear message. Only the confidence moves,
by up to 0.04.

This invalidates a floor of 0.90. `What's the capital of France?` — the
example this feature was conceived around — returned 0.89, 0.90, 0.90,
0.90, 0.90 and 0.92. At a 0.90 floor that message is answered on some
runs and met with silence on others, for no reason a user could ever
discern. A threshold must not sit inside the noise band of a central
case.

Ambiguous messages are unstable in type as well, which is the behaviour
to want. `how do i get to the airport from here?` came back
`general_knowledge` at 0.52 on one run and `directed_at_human` at 0.72
and 0.79 on others. It has no good answer here, and it stays below the
floor whichever way it lands.

That produces a measured separation:

- clear tool questions bottom out at **0.89**
- ambiguous questions reaching a tool type top out at **0.79**

`CONFIDENCE_FLOOR` is therefore **0.85**, in the gap, with roughly 0.04
of margin on the true-positive side and 0.06 on the other. It is the
widest gap the current evidence supports, and it is narrow. This is the
single number most in need of real traffic, which is what
`ClassificationLog` is for.

Two rules follow:

1. **Fixtures are recorded responses replayed offline, never live
   calls.** A test that calls the model cannot be deterministic, so CI
   replays stored payloads. Recording a fresh one is a deliberate act.
2. **Assert the route, never the confidence.** `0.90` and `0.92` are the
   same answer. A test pinned to an exact score fails on a run that
   changed nothing.


## Modules

```
src/utils/question-classifier.ts   Jev over OpenRouter; injectable fetch
src/utils/classification-log.ts    records what the floor rejected
src/utils/question-router.ts       decide(); pure, no I/O
src/utils/answer-embed.ts          buildAnswerEmbed(); one place
src/tools/types.ts                 Tool contract
src/tools/{wikipedia,weather,math,timeDate,serverMember}.ts
src/lib/weather-core.ts            extracted from commands/weather.ts
src/lib/calc-core.ts               extracted from commands/calc.ts
src/models/classificationLog.ts    new table
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

## Recording what the floor rejects

The confidence floor is a filter, and a filter that throws away what it
rejects cannot be tuned. Every classification below the floor is a
question Alia declined to answer, and the set of them is the only honest
measure of whether 0.85 is the right number.

### Keep the whole distribution

Jev returns a probability for every type in the taxonomy, not just the
winner. This design keeps the top three rather than only the argmax:

```ts
{ type: "bot_capability", confidence: 0.84,
  alternatives: [ { type: "about_alia", p: 0.09 },
                  { type: "request_action", p: 0.04 } ] }
```

The runner-up is the diagnosis. `what can you do?` fell to 0.63 because
`about_alia` and `request_action` were competing for it, and the argmax
alone never shows that — the distribution does. Discarding it would mean
knowing a message was rejected without knowing why.

### `ClassificationLog`

Following `src/models/` conventions, with a dated migration:

| Column | Notes |
| --- | --- |
| `guild_id`, `channel_id`, `message_id` | where it came from |
| `content` | `STRING(255)`, truncated |
| `addressed` | mentioned, or passive |
| `type`, `confidence` | the winner |
| `alternatives` | JSON, runners-up with probabilities |
| `route` | `tool:wikipedia`, `llm`, `silent` |
| `created_at` | |

A row is written when:

1. confidence fell below the floor, whatever the type — the main case; or
2. a tool type cleared the floor but the tool returned `null`, meaning
   the routing was right and the tool could not answer. That is a
   different problem from a bad classification and the log must not
   conflate them.

Confident routes are not logged. They are the common case, they are
working, and logging them would bury the interesting rows.

Writes never block a reply and never fail one: the insert is awaited
inside its own try/catch, and a logging failure is recorded and
otherwise ignored.

### Retention

Rows are pruned after 30 days by the existing `schedulerService` polling
interval. This is a log table on a busy server and would otherwise grow
without limit — the same fault already present in three cooldown maps in
this repository, and not one to add deliberately.

Content is stored only for opted-in channels and for messages that
mention Alia. A mentioned message is already sent to an LLM today, so
this adds no exposure there; an opted-in channel is a deliberate choice
by an administrator. Truncation to 255 characters is enough for tuning
and keeps the table small.

### The loop this closes

A script exports the table in the fixture format the regression corpus
already uses. The 27 hand-picked messages become a seed, and the corpus
then grows from real traffic in the server rather than from guesses.

That is what makes the floor tunable with evidence. Raising or lowering
0.85 against 27 invented messages proves nothing, especially when a
single reading of one message can move 0.03 on its own; doing it against
a month of rejected questions is a measurement. The same export is how a
missing type gets discovered: a cluster of rejected messages sharing a
runner-up is a type the taxonomy does not have yet, which is exactly how
`time_date` was found by hand.


## Failure handling

| Failure | Mentioned | Passive |
| --- | --- | --- |
| Jev unreachable or errors | log at `error`, fall through to LLM | log, stay silent |
| Classification below floor | LLM, and write `ClassificationLog` | silent, and write `ClassificationLog` |
| Tool returns `null` | LLM, and write `ClassificationLog` | silent, and write `ClassificationLog` |
| `ClassificationLog` insert fails | log at `warn`, reply normally | log at `warn`, stay silent |
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
  as fixtures, asserting the route rather than the confidence, since the
  model does not return a stable score. Runs offline against recorded
  payloads.
- A variance guard: one test asserts that a message recorded near the
  floor still routes as recorded, so that a future taxonomy change which
  pushes a core question across 0.85 fails loudly rather than quietly
  changing behaviour in production.
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
  `ClassificationLog` exists to replace those guesses with measurements,
  and the floor should not be re-tuned until a month of it exists.
- The 0.85 floor rests on six repetitions of three messages. The gap it
  sits in is about 0.10 wide, which is not much. Widening the margin is
  a matter of narrowing the taxonomy, not of moving the number.
- The log captures what the floor rejected. It cannot capture a confident
  mistake: a message routed to a tool at 0.98 that should have gone to
  the LLM leaves no trace. Catching those needs a reaction or a command
  for people to flag a bad answer, which is deliberately out of scope
  here.
