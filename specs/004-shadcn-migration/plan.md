# Implementation Plan: Migrate Frontend to Real shadcn/ui Components

**Branch**: `004-shadcn-migration` | **Date**: 2026-04-06 | **Spec**: [spec.md](./spec.md)  
**Input**: Feature specification from `/specs/004-shadcn-migration/spec.md`

## Summary

Replace the hand-crafted `src/components/ui.tsx` with the official shadcn/ui component library. Install shadcn/ui and its Radix UI dependencies, initialize the project configuration, add each needed component as individual files under `src/components/ui/`, update all page imports to use the new component APIs (including Dialog for Modal and compound Select/Table), and introduce Vitest + Testing Library to satisfy the constitution's test mandate for input-handling components.

## Technical Context

**Language/Version**: TypeScript 5.9.2 / React 19  
**Primary Dependencies**: React 19, Tailwind CSS 3.4, shadcn/ui (to be installed), Radix UI (via shadcn), Vitest + Testing Library (to be installed)  
**Storage**: N/A (frontend-only change)  
**Testing**: Vitest + @testing-library/react (to be introduced as part of this work)  
**Target Platform**: Modern browser, local Podman deployment  
**Project Type**: Web application — frontend migration  
**Performance Goals**: Pages must achieve initial interactive render within 3 seconds (existing constitution requirement)  
**Constraints**: No backend changes; all existing pages must render without regressions  
**Scale/Scope**: 8 custom components → 8 shadcn/ui components; 7 pages updated

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

| Principle | Status | Notes |
| --------- | ------ | ----- |
| I. Code Quality | ✅ PASS | Migration improves single-responsibility: one file per component replaces monolithic `ui.tsx`. No dead code will remain after removing the old file. |
| II. Testing Standards | ⚠️ VIOLATION — MUST RESOLVE | No test framework exists. Constitution §II requires interaction tests for components handling user input. This migration touches all input-handling pages. **Resolution: Vitest + Testing Library MUST be installed and tests MUST be written before merge.** |
| III. UX Consistency | ✅ PASS | Migration upgrades to the official shadcn/ui library, which is the intended foundation of the constitution's §III "established shadcn-style component library" requirement. |
| IV. Performance | ✅ PASS | Radix UI primitives are performant; no unbounded fetches introduced. |
| Branch Naming | ⚠️ NOTE | Branch `004-shadcn-migration` was created by the speckit tooling and does not follow the constitution's `<work-type>/description` pattern. The correct name would be `chore/shadcn-migration`. This is a known limitation of the current speckit setup and should be tracked as a process improvement. The work itself is valid; this does not block implementation. |
| Technology Table | ✅ PASS (SPIRIT) | The constitution technology table lists "shadcn-style components". This migration adopts the real shadcn/ui, which is the definitive shadcn-style component library. A minor constitution amendment to update the table entry from "shadcn-style components" to "shadcn/ui components" is recommended after this feature merges. |

**Gate result**: Proceed to Phase 0. Testing violation must be resolved during implementation (tests before merge).

## Project Structure

### Documentation (this feature)

```text
specs/004-shadcn-migration/
├── plan.md              # This file
├── research.md          # Phase 0 output (complete)
├── data-model.md        # Phase 1 output (N/A — no data entities)
├── quickstart.md        # Phase 1 output
├── contracts/           # Phase 1 output
│   └── ui-components.md
└── tasks.md             # Phase 2 output (/speckit.tasks command)
```

### Source Code Layout (post-migration)

```text
frontend/
├── src/
│   ├── components/
│   │   ├── ui/                    ← NEW: shadcn/ui components (one file each)
│   │   │   ├── button.tsx
│   │   │   ├── input.tsx
│   │   │   ├── select.tsx
│   │   │   ├── card.tsx
│   │   │   ├── label.tsx
│   │   │   ├── badge.tsx
│   │   │   ├── table.tsx
│   │   │   └── dialog.tsx
│   │   ├── Layout.tsx
│   │   └── ProtectedRoute.tsx
│   │   # ui.tsx DELETED
│   ├── pages/                     ← Updated to use new component APIs
│   │   ├── AccountsPage.tsx
│   │   ├── ClassifierPage.tsx
│   │   ├── DashboardPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ProfilePage.tsx
│   │   └── TransactionsPage.tsx
│   ├── lib/
│   │   ├── utils.ts               ← Existing cn() utility preserved
│   │   └── theme.ts
│   └── ...
├── components.json                ← NEW: shadcn/ui configuration
├── package.json                   ← Updated: shadcn/ui + Radix UI + Vitest
├── vitest.config.ts               ← NEW: test configuration
└── ...

tests/                             ← NEW: interaction tests
├── LoginPage.test.tsx
├── AccountsPage.test.tsx
└── ProfilePage.test.tsx
```

**Structure Decision**: Adopts canonical shadcn/ui layout with `src/components/ui/` per-component files. Tests placed in a top-level `tests/` directory alongside `src/` following Vitest conventions. The old `ui.tsx` monolith is deleted entirely.

## Constitution Amendment (Final Step — Before Merge)

This feature MUST conclude with a PATCH amendment to the project constitution. This is a formal deliverable (see FR-008).

**File**: `.specify/memory/constitution.md`

**Change**: Technology Constraints table, Frontend row:

| Before | After |
| ------ | ----- |
| `React + TypeScript + Tailwind CSS + shadcn-style components` | `React + TypeScript + Tailwind CSS + shadcn/ui` |

**Version bump**: PATCH (wording clarification — no principle added, removed, or redefined)

**Amendment procedure**:

1. Edit `.specify/memory/constitution.md` — update the table cell and increment version (e.g., 1.1.1 → 1.1.2)
2. Update `Last Amended` date
3. Commit the amendment as part of the feature branch (commit message: `docs: amend constitution v1.1.2 — update frontend tech table to shadcn/ui`)

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
| --------- | ---------- | ------------------------------------ |
| Adding Vitest + Testing Library (new dep category) | Constitution §II requires tests for input-handling components; no test framework exists | Deferring tests would be a constitution violation and block merge |
