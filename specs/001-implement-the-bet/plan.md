# Implementation Plan: Discord Bot Engagement Currency & Betting System

**Branch**: `001-implement-the-bet` | **Date**: 2025-09-11 | **Spec**: [spec.md](./spec.md)
**Input**: Feature specification from `/specs/001-implement-the-bet/spec.md`

## Execution Flow (/plan command scope)
```
1. Load feature spec from Input path
   → SUCCESS: Feature spec loaded with 26 functional requirements
2. Fill Technical Context (scan for NEEDS CLARIFICATION)
   → Project Type: Discord bot (single backend service)
   → Structure Decision: Option 1 (single project)
3. Evaluate Constitution Check section below
   → Template-based constitution, evaluate against Discord bot pattern
   → Update Progress Tracking: Initial Constitution Check
4. Execute Phase 0 → research.md
   → Research Discord.js v14 patterns, MySQL/Sequelize optimization, anti-abuse strategies
5. Execute Phase 1 → contracts, data-model.md, quickstart.md, CLAUDE.md
   → Generate slash command contracts, betting system data model
6. Re-evaluate Constitution Check section
   → Update Progress Tracking: Post-Design Constitution Check
7. Plan Phase 2 → Describe task generation approach (DO NOT create tasks.md)
8. STOP - Ready for /tasks command
```

**IMPORTANT**: The /plan command STOPS at step 7. Phases 2-4 are executed by other commands:
- Phase 2: /tasks command creates tasks.md
- Phase 3-4: Implementation execution (manual or via tools)

## Summary
Primary requirement: Discord bot engagement currency system where users earn "Sparks" through meaningful Discord participation and can wager them on community-created prediction markets. Technical approach: Extend existing Alia bot with new slash commands, MySQL database tables for user balances/transactions/bets, and interactive Discord embeds with button-based betting interfaces.

## Technical Context
**Language/Version**: TypeScript with Node.js (existing Discord.js v14 bot)  
**Primary Dependencies**: Discord.js v14, Sequelize ORM, MySQL 8.0, Jest testing framework  
**Storage**: MySQL database (existing infrastructure, new tables for betting system)  
**Testing**: Jest with existing test patterns, Discord.js mock testing  
**Target Platform**: Linux server (Node.js runtime, existing deployment)
**Project Type**: single (Discord bot backend service)  
**Performance Goals**: Sub-200ms slash command response, handle 1000+ concurrent users  
**Constraints**: Discord API rate limits, 60-second interaction timeout, MySQL transaction consistency  
**Scale/Scope**: Single Discord guild initially, ~500 active users, 100+ concurrent bets

## Constitution Check
*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

**Simplicity**:
- Projects: 1 (existing Discord bot extended)
- Using framework directly? (Discord.js directly, no wrappers)
- Single data model? (Normalized MySQL tables, no DTOs)
- Avoiding patterns? (Direct Sequelize models, no Repository pattern)

**Architecture**:
- EVERY feature as library? (Extending existing command/response modules)
- Libraries listed: betting-engine + currency-manager + engagement-tracker
- CLI per library: N/A (Discord bot, not CLI application)
- Library docs: Internal JSDoc comments for Discord bot modules

**Testing (NON-NEGOTIABLE)**:
- RED-GREEN-Refactor cycle enforced? (Yes, write failing tests first)
- Git commits show tests before implementation? (Yes, TDD approach)
- Order: Contract→Integration→E2E→Unit strictly followed? (Yes, slash commands → full flows → units)
- Real dependencies used? (Actual MySQL, Discord API mocking)
- Integration tests for: new slash commands, database operations, Discord interactions
- FORBIDDEN: Implementation before test, skipping RED phase

**Observability**:
- Structured logging included? (Existing Bunyan logger integration)
- Frontend logs → backend? (Discord client events → server logs)
- Error context sufficient? (Sentry integration for Discord errors)

**Versioning**:
- Version number assigned? (Extend existing bot versioning)
- BUILD increments on every change? (Follow existing npm version pattern)
- Breaking changes handled? (Database migrations for new tables)

## Project Structure

### Documentation (this feature)
```
specs/001-implement-the-bet/
├── plan.md              # This file (/plan command output)
├── research.md          # Phase 0 output (/plan command)
├── data-model.md        # Phase 1 output (/plan command)
├── quickstart.md        # Phase 1 output (/plan command)
├── contracts/           # Phase 1 output (/plan command)
└── tasks.md             # Phase 2 output (/tasks command - NOT created by /plan)
```

### Source Code (repository root)
```
# Extending existing Discord bot structure
src/
├── commands/
│   ├── bet.ts          # /bet slash command family
│   ├── balance.ts      # /balance command
│   └── lastseen.ts     # /lastseen command
├── models/
│   ├── BetUsers.ts     # User management
│   ├── BetBalances.ts  # Currency balances
│   ├── BetLedger.ts    # Transaction history
│   ├── BetWagers.ts    # Betting system
│   └── BetParticipants.ts # Bet participation
├── responses/
│   └── engagement.ts   # Engagement earning system
├── utils/
│   ├── betting.ts      # Betting calculations
│   └── currency.ts     # Currency operations
└── services/
    ├── engagementService.ts  # Spark earning logic
    └── bettingService.ts     # Bet management

tests/
├── commands/           # Slash command tests
├── models/            # Database model tests
├── integration/       # Full workflow tests
└── utils/            # Utility function tests
```

**Structure Decision**: Option 1 (single project) - Extending existing Discord bot codebase

## Phase 0: Outline & Research
1. **Extract unknowns from Technical Context** above:
   - Discord.js v14 interaction patterns for complex betting UI
   - MySQL transaction handling for escrow operations
   - Anti-abuse strategies for engagement earning
   - Performance optimization for high-frequency balance updates

2. **Generate and dispatch research agents**:
   ```
   Task: "Research Discord.js v14 advanced interaction patterns for betting interfaces"
   Task: "Find best practices for MySQL transaction handling in Node.js applications"
   Task: "Research anti-spam and rate limiting patterns for Discord bots"
   Task: "Investigate Discord embed and button interaction performance optimization"
   ```

3. **Consolidate findings** in `research.md` using format:
   - Decision: [what was chosen]
   - Rationale: [why chosen]
   - Alternatives considered: [what else evaluated]

**Output**: research.md with all technical decisions documented

## Phase 1: Design & Contracts
*Prerequisites: research.md complete*

1. **Extract entities from feature spec** → `data-model.md`:
   - BetUsers: Discord user mapping with privacy settings
   - BetBalances: Current balance with escrow tracking  
   - BetLedger: Transaction audit trail
   - BetWagers: Betting market with odds and timing
   - BetParticipants: User participation in specific bets
   - BetEngagementStats: Anti-abuse tracking

2. **Generate API contracts** from functional requirements:
   - /bet open - Create new betting market
   - /bet join - Join existing bet
   - /bet list - Browse available bets
   - /bet settle - Moderator settlement
   - /balance - Show user financial status
   - /lastseen - Social feature query
   - Output Discord slash command schemas to `/contracts/`

3. **Generate contract tests** from contracts:
   - One test file per slash command
   - Assert Discord interaction request/response patterns
   - Tests must fail (no implementation yet)

4. **Extract test scenarios** from user stories:
   - New user earning Sparks → integration test
   - Creating and joining bets → full betting workflow
   - Moderator settlement → payout calculation test

5. **Update agent file incrementally** (O(1) operation):
   - Run `/scripts/update-agent-context.sh claude` 
   - Add Discord bot + MySQL + betting system context
   - Preserve existing manual additions
   - Update recent changes with betting feature

**Output**: data-model.md, /contracts/*, failing tests, quickstart.md, CLAUDE.md

## Phase 2: Task Planning Approach
*This section describes what the /tasks command will do - DO NOT execute during /plan*

**Task Generation Strategy**:
- Load `/templates/tasks-template.md` as base
- Generate tasks from Phase 1 design docs (contracts, data model, quickstart)
- Each slash command → contract test task [P]
- Each database model → model creation task [P] 
- Each user story → integration test task
- Engagement earning system → core implementation task
- Betting calculations → utility function tasks

**Ordering Strategy**:
- TDD order: Contract tests → Integration tests → Implementation
- Dependency order: Database models → Services → Commands → Responses
- Mark [P] for parallel execution (independent slash commands)

**Estimated Output**: 30-35 numbered, ordered tasks in tasks.md

**IMPORTANT**: This phase is executed by the /tasks command, NOT by /plan

## Phase 3+: Future Implementation
*These phases are beyond the scope of the /plan command*

**Phase 3**: Task execution (/tasks command creates tasks.md)  
**Phase 4**: Implementation (execute tasks.md following constitutional principles)  
**Phase 5**: Validation (run tests, execute quickstart.md, performance validation)

## Complexity Tracking
*Fill ONLY if Constitution Check has violations that must be justified*

No constitutional violations identified. The Discord bot architecture aligns with simplicity principles:
- Single project extension
- Direct framework usage (Discord.js, Sequelize)
- No unnecessary patterns or abstractions

## Progress Tracking
*This checklist is updated during execution flow*

**Phase Status**:
- [x] Phase 0: Research complete (/plan command)
- [x] Phase 1: Design complete (/plan command)
- [x] Phase 2: Task planning complete (/plan command - describe approach only)
- [ ] Phase 3: Tasks generated (/tasks command)
- [ ] Phase 4: Implementation complete
- [ ] Phase 5: Validation passed

**Gate Status**:
- [x] Initial Constitution Check: PASS
- [x] Post-Design Constitution Check: PASS
- [x] All NEEDS CLARIFICATION resolved
- [x] Complexity deviations documented (none required)

---
*Based on Constitution v2.1.1 - See `/memory/constitution.md`*