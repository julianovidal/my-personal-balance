<!--
Sync Impact Report
==================
Version change: 1.1.0 → 1.1.1
Modified principles: N/A
Added sections: N/A
Removed sections: N/A
Amendment summary:
  - §Development Workflow §6 Branch Naming: added `docs` work-type prefix for
    documentation changes (README, AGENTS.md, specs, and other doc artifacts).
    AGENTS.md updated in lockstep.
Templates reviewed:
  - .specify/templates/plan-template.md   ✅ No branch-naming references; unaffected
  - .specify/templates/spec-template.md   ✅ No branch-naming references; unaffected
  - .specify/templates/tasks-template.md  ✅ No branch-naming references; unaffected
  - .specify/templates/agent-file-template.md ✅ No branch-naming references; unaffected
  - README.md                             ✅ No branch-naming references; unaffected
Deferred TODOs: None
-->

# My Personal Balance Constitution

## Core Principles

### I. Code Quality (NON-NEGOTIABLE)

All code across backend, frontend, and classifier services MUST be clean, maintainable,
and self-consistent:

- Code MUST follow the language/framework conventions of its service: PEP 8 + FastAPI
  patterns for Python; ESLint + React/TypeScript conventions for the frontend.
- Functions and modules MUST have a single, clearly defined responsibility; side effects
  MUST be explicit and minimal.
- Business logic MUST be separated from I/O concerns (HTTP handlers, DB queries, UI
  rendering).
- Code MUST NOT be merged if it introduces dead code, commented-out blocks, or
  placeholder stubs without a linked task in the tracker.
- Complexity MUST be justified: every abstraction layer or pattern (e.g., repository,
  service, context provider) requires a documented rationale. Default to the simplest
  approach that solves the problem.

**Rationale**: Financial data management demands high correctness. Unmaintainable code
accumulates hidden bugs that are especially dangerous in monetary calculations and
user authentication flows.

### II. Testing Standards (NON-NEGOTIABLE)

A test discipline MUST be followed for all functional changes across every service:

- New API endpoints MUST have at least one integration test covering the happy path and
  one covering a relevant error path (e.g., invalid auth, missing or malformed data).
- Frontend components that render financial data or handle user input MUST have unit or
  interaction tests; purely presentational components are exempt.
- The classifier service MUST have tests validating prediction correctness against a
  held-out test set; this validation MUST be part of CI.
- Tests MUST be written before the implementation is considered complete. Test-last is
  permitted only for exploratory spikes, which MUST NOT be merged as-is.
- All tests MUST pass on the main branch at all times; a failing test MUST block merge.

**Rationale**: The cost of a financial calculation error or a broken authentication flow
far exceeds the cost of writing tests. Mandatory coverage prevents regressions and
provides a safety net for future refactoring.

### III. User Experience Consistency

The frontend MUST deliver a coherent and predictable experience across all screens:

- UI components MUST be drawn from the established shadcn-style component library.
  Custom one-off components are NOT permitted unless the library cannot fulfill the
  requirement, with documented justification.
- Loading, error, and empty states MUST be handled explicitly on every data-fetching
  view. Unhandled promise rejections or undefined renders MUST NOT reach the user.
- All monetary values MUST be displayed with the correct currency symbol and
  locale-appropriate formatting (decimal separator, thousands separator) sourced from
  the account's `currency` field.
- Navigation, layout, and color semantics (e.g., red for expenses, green for income)
  MUST be consistent across all pages.
- Forms MUST provide real-time or on-submit validation feedback; silent failures are
  prohibited.

**Rationale**: Users trust this tool with their financial data. Inconsistent UI creates
confusion and erodes confidence. Consistent currency display is especially critical
to avoid misreading financial figures.

### IV. Performance Requirements

The system MUST remain responsive under expected personal-use load:

- Backend API endpoints MUST respond within 500 ms at p95 under normal operating
  conditions (single user, local Podman deployment).
- List and paginated endpoints (transactions explorer, monthly summaries) MUST use
  server-side pagination. Client-side fetching of unbounded result sets is prohibited.
- Frontend pages MUST achieve an initial interactive render within 3 seconds on a
  modern browser with a standard network connection.
- The classifier training endpoint is exempt from the 500 ms rule but MUST complete
  within 60 seconds for datasets up to 10,000 transactions. Prediction endpoints MUST
  respond within 500 ms.
- Database queries MUST use indexed columns for all filter and sort operations exposed
  through the API. Unindexed full-table scans on large tables are prohibited without
  documented justification.

**Rationale**: Slow financial tools are abandoned. Sluggish pagination or unresponsive
charts undermine the tool's value and can obscure data integrity issues.

## Technology Constraints

The following technology stack is fixed for all services and MUST NOT be substituted
without a formal constitution amendment:

| Layer | Technology |
| - | - |
| Backend API | FastAPI + SQLAlchemy + Alembic + JWT |
| Database | PostgreSQL |
| Classifier | FastAPI + scikit-learn |
| Frontend | React + TypeScript + Tailwind CSS + shadcn-style components |
| Runtime | Podman + podman-compose |

- Dependencies MUST be pinned to exact versions in their respective lock files
  (`pyproject.toml` / `uv.lock` for Python services; `pnpm-lock.yaml` for the
  frontend Node service managed with **pnpm**).
- New external dependencies MUST be evaluated for maintenance status and security
  posture before inclusion. Unmaintained or vulnerability-prone packages MUST NOT be
  added.
- Database schema changes MUST go through Alembic migrations. Direct schema mutations
  are prohibited.

## Development Workflow

All functional work MUST follow this sequence:

1. **Spec first**: A feature specification (`spec.md`) MUST exist before implementation
   begins. Coding without an accepted spec is prohibited except for exploratory spikes,
   which MUST NOT be merged as-is.
2. **Plan before code**: An implementation plan (`plan.md`) MUST be produced and pass
   the Constitution Check before Phase 1 tasks begin.
3. **Tests before merge**: All applicable tests (integration, unit, contract) MUST be
   written and passing before a feature branch is merged.
4. **Review for principles**: Every PR MUST be reviewed against all four Core
   Principles; a checklist confirmation is required.
5. **Migration safety**: Any backend change that alters the database schema MUST include
   a forward Alembic migration and, where data loss is possible, a rollback migration.
6. **Branch naming**: Every branch MUST follow the pattern
   `<work-type>/brief-description-from-spec`. The permitted work-type prefixes are:

   | Prefix | When to use |
   | - | - |
   | `feat` | A new feature directly related to the product (not tooling or architecture). |
   | `chore` | Non-feature work: architecture changes, tooling updates, dependency upgrades, project structure. |
   | `fix` | Repairing a broken feature — a regression, a missed test scenario, or a broken flow. |
   | `docs` | Adding or updating documentation: README files, AGENTS.md files, specs, and other doc artifacts. |
   | `other` | All changes that do not fit the above categories. |

   A branch MUST use exactly one prefix. The description segment MUST be lowercase,
   hyphen-separated, and derived from the associated spec or task title. Example:
   `feat/csv-transaction-import`, `fix/auth-token-expiry`.

## Governance

This constitution supersedes all other practices, patterns, and conventions within the
My Personal Balance project. Where a conflict exists between an AGENTS.md file and this
constitution, this constitution takes precedence.

**Amendment procedure**:

- Any amendment MUST update this document and increment the version per semantic
  versioning rules (MAJOR / MINOR / PATCH).
- Amendments that remove or redefine a Core Principle require a MAJOR version bump.
- Amendments that add a principle or materially expand guidance require a MINOR bump.
- Clarifications and wording fixes require a PATCH bump.
- `Last Amended` MUST be updated on every change.

**Compliance**: All PRs and implementation plans MUST verify compliance with this
constitution. The Constitution Check section in `plan.md` is the formal gate; it MUST
be completed before coding begins and re-verified after Phase 1 design.

**Runtime guidance**: For day-to-day development context, refer to the per-service
AGENTS.md files (`backend/AGENTS.md`, `frontend/AGENTS.md`, `classifier/AGENTS.md`)
alongside this constitution.

**Version**: 1.1.1 | **Ratified**: 2026-04-06 | **Last Amended**: 2026-04-06
