<!--
Sync Impact Report:
- Version change: Template → 1.0.0 (Initial ratification)
- Modified principles: All principles newly defined
- Added sections: Core Principles (7), Development Workflow, Governance
- Removed sections: None (template conversion)
- Templates requiring updates:
  ✅ plan-template.md - Constitution Check section references this file
  ✅ spec-template.md - No changes needed (tech-agnostic)
  ✅ tasks-template.md - TDD ordering aligns with Principle III
- Follow-up TODOs: None
-->

# Alia-Bot Development Constitution

## Core Principles

### I. User-First Simplicity
Discord bot commands and interactions MUST prioritize user experience through:
- Intuitive command naming that reflects Discord user mental models
- Minimal required parameters with smart defaults
- Clear, actionable error messages that guide users to success
- Consistent interaction patterns across all bot features

**Rationale**: Discord users expect instant utility without reading documentation. Complex commands reduce adoption and create support burden.

### II. Modern Discord Interface Adoption
All new features MUST leverage Discord.js v14+ capabilities:
- **Interactive Components**: Use buttons, select menus, and modals instead of text-only responses
- **Rich Embeds**: Present structured data with embeds (fields, colors, thumbnails)
- **Ephemeral Responses**: Use `ephemeral: true` for personal/sensitive information
- **Deferred Interactions**: Call `deferReply()` or `deferUpdate()` for operations >3 seconds
- **Component Collectors**: Implement timeout cleanup to prevent memory leaks

**FORBIDDEN**: Reaction-based navigation, plain text walls, DM-only workflows (unless explicitly required)

**Rationale**: Modern Discord interface patterns provide superior UX and are expected by users familiar with other contemporary bots.

### III. Test-Driven Development (NON-NEGOTIABLE)
TDD cycle MUST be strictly enforced for all production code:

1. **RED Phase**: Write failing test that defines expected behavior
2. **User Approval Gate**: Present test to stakeholder/reviewer for validation
3. **GREEN Phase**: Write minimal code to make test pass
4. **REFACTOR Phase**: Improve code quality while keeping tests green

**Test Order**: Contract tests → Integration tests → Unit tests (implementation details)

**Coverage Requirements**:
- Minimum 40% overall coverage (Jest)
- All slash commands MUST have contract tests
- All database operations MUST have integration tests
- Critical business logic MUST have unit tests

**Git Evidence**: Test commits MUST precede implementation commits for the same feature

**FORBIDDEN**:
- Implementation before tests
- Skipping RED phase ("I'll write tests later")
- Merging PRs with failing tests
- Reducing coverage percentage

**Rationale**: TDD prevents regressions, documents behavior, and ensures testable design. Non-negotiable status reflects production deployment criticality.

### IV. Multi-Tenancy Architecture
All features MUST support multiple Discord guilds without code changes:

- **Guild Context Isolation**: Every database query MUST filter by `guild_id`
- **Configuration per Guild**: Settings, permissions, and data scoped to guild
- **No Hardcoded Guild IDs**: Use environment variables or database configuration
- **Guild Registration**: Automatic setup when bot joins new server
- **Data Separation**: No cross-guild data leakage in queries or responses

**Current Deployment**: Bot serves 2+ guilds; architecture must scale to N guilds

**Rationale**: Single-tenant code creates technical debt and prevents bot from scaling to new communities.

### V. Observability & Debugging
All production code MUST include structured observability:

- **Structured Logging**: Use Bunyan logger with context fields (guild_id, user_id, command)
- **Error Tracking**: Sentry integration for production error monitoring
- **Performance Metrics**: Log slow operations (>200ms response time)
- **Audit Trails**: Log all moderator actions and currency transactions
- **Debug Context**: Include relevant Discord message/interaction IDs in logs

**FORBIDDEN**:
- `console.log` in production code
- Logging sensitive data (tokens, passwords, email addresses)
- Empty catch blocks without logging

**Rationale**: Production Discord bot serves live communities; debugging without logs is impossible. Structured logs enable filtering and correlation.

### VI. Versioning & Breaking Changes
Feature development MUST follow semantic versioning discipline:

- **package.json Version**: Single source of truth for bot version
- **Git Tags**: Tag releases as `vMAJOR.MINOR.PATCH`
- **Changelog**: Document user-facing changes in CHANGELOG.md

**Breaking Changes**:
- MAJOR: Remove slash commands, change command parameters, database schema incompatibility
- MINOR: Add new commands, extend command parameters, backward-compatible DB migrations
- PATCH: Bug fixes, performance improvements, internal refactoring

**Migration Strategy**:
- Database migrations MUST be reversible (up/down scripts)
- Deprecated commands MUST show warning for 1 minor version before removal
- Configuration changes MUST preserve backward compatibility or provide migration script

**Rationale**: Multiple guilds depend on bot stability; breaking changes require coordination with community moderators.

### VII. Protected Master Branch
All changes to production code MUST follow pull request workflow:

- **Direct Commits**: FORBIDDEN to master branch
- **PR Requirements**:
  - All tests passing (Jest + ESLint)
  - Code review approval (manual or automated)
  - No merge conflicts with master
  - Branch up-to-date with master
- **Branch Naming**: `feature/description-issue-number`, `fix/description-issue-number`, `docs/description`
- **Commit Messages**: Conventional commits format (`feat:`, `fix:`, `docs:`, `test:`)

**Deployment Flow**: master branch → production environment (protected)

**Rationale**: Production bot serves live communities; untested code causes immediate user impact. PR workflow enforces review and testing gates.

## Development Workflow

### Feature Development Lifecycle
1. **Specification** (`/specify`): Define user-facing requirements without implementation details
2. **Planning** (`/plan`): Research technical approach, generate data models and contracts
3. **Task Breakdown** (`/tasks`): Create ordered, testable task list following TDD principles
4. **Implementation**: Execute tasks with RED-GREEN-REFACTOR cycle
5. **Validation**: Run quickstart scenarios, verify performance targets, update documentation

### Code Review Standards
- **Test Coverage**: Verify tests precede implementation (git history check)
- **Multi-Tenancy**: Check for guild_id filtering in database queries
- **Error Handling**: Ensure user-facing errors are actionable
- **Logging**: Confirm structured logging with context
- **Discord Patterns**: Validate modern interaction patterns (buttons vs reactions)

### Quality Gates
- **Pre-Commit**: ESLint passing, TypeScript compilation successful
- **Pre-PR**: All tests passing, coverage ≥40%, migrations tested
- **Pre-Merge**: Code review approval, branch updated with master, CI passing
- **Pre-Deploy**: Integration tests passing, quickstart scenarios validated

## Governance

### Constitutional Authority
This constitution supersedes all other development practices and guidelines. When conflicts arise between this document and other documentation (README, CLAUDE.md, inline comments), this constitution takes precedence.

### Amendment Process
1. **Proposal**: Document proposed change with rationale and impact analysis
2. **Review**: Evaluate against current feature development and deployment needs
3. **Approval**: Consensus from project maintainers required
4. **Migration**: Update dependent templates, documentation, and code
5. **Version Bump**: Increment constitution version (MAJOR for principle removal/redefinition, MINOR for additions, PATCH for clarifications)

### Compliance Verification
- **All PRs**: Verify adherence to TDD cycle, multi-tenancy, and master branch protection
- **Code Reviews**: Check observability (logging), error handling, and modern Discord patterns
- **Periodic Audits**: Review test coverage trends, breaking change frequency, and versioning discipline

### Complexity Justification
Any deviation from constitutional principles MUST be documented with:
- **Violation Description**: Which principle(s) violated and how
- **Business Justification**: Why deviation necessary for feature success
- **Mitigation Plan**: How to minimize impact and return to compliance
- **Approval**: Explicit sign-off from project maintainer

**Version**: 1.0.0 | **Ratified**: 2025-10-01 | **Last Amended**: 2025-10-01
