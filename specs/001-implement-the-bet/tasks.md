# Tasks: Discord Bot Engagement Currency & Betting System

**Input**: Design documents from `/specs/001-implement-the-bet/`
**Prerequisites**: plan.md (✓), research.md (✓), data-model.md (✓), contracts/ (✓)

## Execution Flow (main)
```
1. Load plan.md from feature directory
   → SUCCESS: TypeScript Discord bot extension with MySQL
   → Extract: Discord.js v14, Sequelize ORM, Jest testing
2. Load optional design documents:
   → data-model.md: 6 entities → 6 model tasks
   → contracts/: 2 files → 8 contract test tasks  
   → research.md: Performance decisions → setup tasks
3. Generate tasks by category:
   → Setup: migrations, dependencies, linting
   → Tests: 8 contract tests, 5 integration tests
   → Core: 6 models, 3 services, 6 commands
   → Integration: engagement tracking, message handlers
   → Polish: unit tests, performance validation
4. Apply task rules:
   → Different files = mark [P] for parallel
   → Same file = sequential (no [P])
   → Tests before implementation (TDD)
5. Number tasks sequentially (T001-T040)
6. Generate dependency graph
7. Create parallel execution examples
8. Validate task completeness:
   → All 6 slash commands have contract tests ✓
   → All 6 entities have model tasks ✓
   → All 5 quickstart scenarios have integration tests ✓
9. Return: SUCCESS (tasks ready for execution)
```

## Format: `[ID] [P?] Description`
- **[P]**: Can run in parallel (different files, no dependencies)
- Include exact file paths in descriptions

## Path Conventions
- **Single project**: `src/`, `tests/` at repository root
- Extending existing Discord bot structure per plan.md

## Phase 3.1: Setup & Database Migrations
- [ ] T001 Create database migration for BetUsers table in `migrations/XXX-create-bet-users.js`
- [ ] T002 [P] Create database migration for BetBalances table in `migrations/XXX-create-bet-balances.js`
- [ ] T003 [P] Create database migration for BetLedger table in `migrations/XXX-create-bet-ledger.js`
- [ ] T004 [P] Create database migration for BetWagers table in `migrations/XXX-create-bet-wagers.js`
- [ ] T005 [P] Create database migration for BetParticipants table in `migrations/XXX-create-bet-participants.js`
- [ ] T006 [P] Create database migration for BetEngagementStats table in `migrations/XXX-create-bet-engagement-stats.js`
- [ ] T007 Run all betting system migrations and verify database schema

## Phase 3.2: Tests First (TDD) ⚠️ MUST COMPLETE BEFORE 3.3
**CRITICAL: These tests MUST be written and MUST FAIL before ANY implementation**

### Contract Tests (Based on contracts/bet-commands.json)
- [ ] T008 [P] Contract test /bet open command in `tests/commands/bet-open.test.ts`
- [ ] T009 [P] Contract test /bet join command in `tests/commands/bet-join.test.ts`
- [ ] T010 [P] Contract test /bet list command in `tests/commands/bet-list.test.ts`
- [ ] T011 [P] Contract test /bet settle command in `tests/commands/bet-settle.test.ts`
- [ ] T012 [P] Contract test /balance command in `tests/commands/balance.test.ts`
- [ ] T013 [P] Contract test /lastseen command in `tests/commands/lastseen.test.ts`

### Button Interaction Tests (Based on contracts/discord-interactions.json)
- [ ] T014 [P] Button interaction test for bet-join-for in `tests/interactions/bet-buttons.test.ts`
- [ ] T015 [P] Modal submission test for bet-join-modal in `tests/interactions/bet-modals.test.ts`

### Integration Tests (Based on quickstart.md scenarios)
- [ ] T016 [P] Integration test: New user onboarding & Spark earning in `tests/integration/user-onboarding.test.ts`
- [ ] T017 [P] Integration test: Creating and joining bets workflow in `tests/integration/betting-workflow.test.ts`
- [ ] T018 [P] Integration test: Bet settlement & payouts in `tests/integration/bet-settlement.test.ts`
- [ ] T019 [P] Integration test: Anti-abuse & rate limiting in `tests/integration/anti-abuse.test.ts`
- [ ] T020 [P] Integration test: Social features & privacy controls in `tests/integration/social-features.test.ts`

## Phase 3.3: Data Models (ONLY after tests are failing)
- [ ] T021 [P] BetUsers model in `src/models/BetUsers.ts`
- [ ] T022 [P] BetBalances model in `src/models/BetBalances.ts`
- [ ] T023 [P] BetLedger model in `src/models/BetLedger.ts`
- [ ] T024 [P] BetWagers model in `src/models/BetWagers.ts`
- [ ] T025 [P] BetParticipants model in `src/models/BetParticipants.ts`
- [ ] T026 [P] BetEngagementStats model in `src/models/BetEngagementStats.ts`

## Phase 3.4: Core Services
- [ ] T027 EngagementService for Spark earning logic in `src/services/engagementService.ts`
- [ ] T028 BettingService for bet management in `src/services/bettingService.ts` 
- [ ] T029 CurrencyService for balance operations in `src/services/currencyService.ts`

## Phase 3.5: Slash Commands Implementation
- [ ] T030 /bet open command in `src/commands/bet.ts` (create bet subcommand)
- [ ] T031 /bet join command in `src/commands/bet.ts` (join bet subcommand)
- [ ] T032 /bet list command in `src/commands/bet.ts` (list bets subcommand)
- [ ] T033 /bet settle command in `src/commands/bet.ts` (settle bet subcommand)
- [ ] T034 [P] /balance command in `src/commands/balance.ts`
- [ ] T035 [P] /lastseen command in `src/commands/lastseen.ts`

## Phase 3.6: Message Handling & Engagement
- [ ] T036 Engagement response handler in `src/responses/engagement.ts`
- [ ] T037 Register new slash commands with Discord API

## Phase 3.7: Utility Functions & Helpers
- [ ] T038 [P] Betting calculations utilities in `src/utils/betting.ts`
- [ ] T039 [P] Currency operations utilities in `src/utils/currency.ts`

## Phase 3.8: Polish & Validation
- [ ] T040 Run complete quickstart.md validation scenarios
- [ ] T041 Performance testing: verify <200ms command response times
- [ ] T042 Load testing: verify 1000+ concurrent user support
- [ ] T043 Database consistency validation and balance reconciliation
- [ ] T044 Update main CLAUDE.md with betting system patterns and examples

## Dependencies

### Setup Dependencies
- T001-T006 (migrations) must complete before T007 (schema verification)
- T007 must complete before any database-dependent tests or models

### Test Dependencies (TDD Enforcement)
- ALL tests (T008-T020) MUST be written and failing before ANY implementation
- Tests must fail verification before proceeding to Phase 3.3

### Implementation Dependencies  
- T021-T026 (models) before T027-T029 (services)
- T027-T029 (services) before T030-T037 (commands/handlers)
- T030-T033 (bet command family) are sequential (same file)
- T034-T035 (balance/lastseen) are parallel (different files)

### Integration Dependencies
- T036 (engagement handler) requires T027 (EngagementService)
- T037 (command registration) requires T030-T035 (all commands)

### Polish Dependencies
- T040-T043 (validation) require ALL implementation tasks complete
- T044 (documentation) can run parallel with validation

## Parallel Execution Examples

### Phase 3.1 - Database Setup (after T001)
```bash
# Launch migration creation in parallel:
Task: "Create database migration for BetBalances table in migrations/XXX-create-bet-balances.js"
Task: "Create database migration for BetLedger table in migrations/XXX-create-bet-ledger.js"  
Task: "Create database migration for BetWagers table in migrations/XXX-create-bet-wagers.js"
Task: "Create database migration for BetParticipants table in migrations/XXX-create-bet-participants.js"
Task: "Create database migration for BetEngagementStats table in migrations/XXX-create-bet-engagement-stats.js"
```

### Phase 3.2 - Contract Tests (TDD)
```bash
# Launch all slash command contract tests in parallel:
Task: "Contract test /bet open command in tests/commands/bet-open.test.ts"
Task: "Contract test /bet join command in tests/commands/bet-join.test.ts"
Task: "Contract test /bet list command in tests/commands/bet-list.test.ts"
Task: "Contract test /bet settle command in tests/commands/bet-settle.test.ts"
Task: "Contract test /balance command in tests/commands/balance.test.ts"
Task: "Contract test /lastseen command in tests/commands/lastseen.test.ts"
```

### Phase 3.2 - Integration Tests
```bash
# Launch all integration tests in parallel:
Task: "Integration test: New user onboarding & Spark earning in tests/integration/user-onboarding.test.ts"
Task: "Integration test: Creating and joining bets workflow in tests/integration/betting-workflow.test.ts"
Task: "Integration test: Bet settlement & payouts in tests/integration/bet-settlement.test.ts"
Task: "Integration test: Anti-abuse & rate limiting in tests/integration/anti-abuse.test.ts"
Task: "Integration test: Social features & privacy controls in tests/integration/social-features.test.ts"
```

### Phase 3.3 - Database Models
```bash
# Launch all model creation in parallel:
Task: "BetUsers model in src/models/BetUsers.ts"
Task: "BetBalances model in src/models/BetBalances.ts"
Task: "BetLedger model in src/models/BetLedger.ts"
Task: "BetWagers model in src/models/BetWagers.ts"
Task: "BetParticipants model in src/models/BetParticipants.ts"
Task: "BetEngagementStats model in src/models/BetEngagementStats.ts"
```

### Phase 3.7 - Utilities
```bash
# Launch utility functions in parallel:
Task: "Betting calculations utilities in src/utils/betting.ts"
Task: "Currency operations utilities in src/utils/currency.ts"
```

## Notes
- [P] tasks = different files, no dependencies
- Verify ALL tests fail before implementing (TDD enforcement)
- Commit after each task completion
- Run `npm run lint && npm run test` after each phase
- /bet command subcommands (T030-T033) are sequential - same file modifications

## Task Generation Rules Applied

1. **From Contracts**:
   - 6 slash commands → 6 contract test tasks [P] (T008-T013)
   - 2 interaction patterns → 2 interaction test tasks [P] (T014-T015)
   
2. **From Data Model**:
   - 6 entities → 6 model creation tasks [P] (T021-T026)
   - Relationships → 3 service layer tasks (T027-T029)
   
3. **From User Stories (quickstart.md)**:
   - 5 scenarios → 5 integration tests [P] (T016-T020)
   - Performance requirements → validation tasks (T041-T043)

4. **Ordering Applied**:
   - Setup → Tests → Models → Services → Commands → Integration → Polish
   - TDD enforcement: ALL tests before ANY implementation

## Validation Checklist
*GATE: Checked before task execution*

- [✓] All 6 slash commands have corresponding contract tests
- [✓] All 6 entities have model tasks  
- [✓] All tests come before implementation (Phase 3.2 before 3.3+)
- [✓] Parallel tasks truly independent (different files)
- [✓] Each task specifies exact file path
- [✓] No [P] task modifies same file as another [P] task
- [✓] Integration tests cover all quickstart scenarios
- [✓] Performance and validation tasks included