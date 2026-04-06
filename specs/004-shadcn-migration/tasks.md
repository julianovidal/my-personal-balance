---
description: "Task list for 004-shadcn-migration"
---

# Tasks: Migrate Frontend to Real shadcn/ui Components

**Input**: Design documents from `/specs/004-shadcn-migration/`
**Prerequisites**: plan.md, spec.md, research.md, contracts/ui-components.md, quickstart.md

**Tests**: Included — constitution §II mandates interaction tests for input-handling components.

**Organization**: Tasks grouped by user story for independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies on incomplete tasks)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)

## Path Conventions

All paths relative to repository root. Frontend work lives under `frontend/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Install dependencies and configure tooling for shadcn/ui and testing

- [X] T001 Initialize shadcn/ui in `frontend/` — run `pnpm dlx shadcn@latest init` (select: New York style, Zinc base color, CSS variables yes, components path `src/components/ui`) to generate `frontend/components.json` and install Radix UI peer dependencies
- [X] T002 Install Vitest and Testing Library in `frontend/` — run `pnpm add -D vitest @testing-library/react @testing-library/jest-dom @testing-library/user-event jsdom`
- [X] T003 [P] Create `frontend/vitest.config.ts` — configure test environment to jsdom, add Testing Library setup file reference, include glob for `tests/**/*.test.tsx`
- [X] T004 [P] Add test scripts to `frontend/package.json` — add `"test": "vitest run"` and `"test:watch": "vitest"` to the `scripts` section

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Generate all 8 shadcn/ui component files and extend Badge with the custom warning variant. Must complete before any page migration begins.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete

- [X] T005 Add all required shadcn/ui components in `frontend/` — run `pnpm dlx shadcn@latest add button input label card badge select dialog table` to generate all 8 component files in `frontend/src/components/ui/`
- [X] T006 Add custom `warning` variant to `frontend/src/components/ui/badge.tsx` — extend the `badgeVariants` CVA config with `warning: "border-transparent bg-yellow-100 text-yellow-800 hover:bg-yellow-100/80 dark:bg-yellow-900 dark:text-yellow-200"`
- [X] T007 Create `frontend/tests/` directory and add a `frontend/tests/setup.ts` file that imports `@testing-library/jest-dom` — configure this as the setup file in `frontend/vitest.config.ts`

**Checkpoint**: Foundation ready — all shadcn/ui component files exist in `frontend/src/components/ui/`, Vitest is configured, and user story work can now begin

---

## Phase 3: User Story 1 - Replace Custom Components (Priority: P1) 🎯 MVP

**Goal**: All 7 pages and Layout use official shadcn/ui components; the custom `ui.tsx` file is deleted

**Independent Test**: Run `pnpm test` in `frontend/` — all interaction tests pass; run `pnpm build` — zero TypeScript errors; open every page in the browser — no missing or broken UI elements

### Tests for User Story 1 (constitution §II — required before merge)

> **NOTE: Write these tests FIRST and verify they FAIL before implementing page migrations**

- [X] T008 [P] [US1] Write interaction test for LoginPage in `frontend/tests/LoginPage.test.tsx` — test that submitting the form with valid credentials calls the auth handler; test that form shows validation feedback when fields are empty
- [X] T009 [P] [US1] Write interaction test for AccountsPage in `frontend/tests/AccountsPage.test.tsx` — test that clicking "Add Account" opens the dialog; test that submitting the account form calls the create handler; test that the Select dropdown renders options correctly
- [X] T010 [P] [US1] Write interaction test for ProfilePage in `frontend/tests/ProfilePage.test.tsx` — test that editing profile opens the dialog; test that submitting the profile form calls the update handler

### Implementation for User Story 1

- [X] T011 [P] [US1] Migrate `frontend/src/components/Layout.tsx` — update import from `@/components/ui` to `@/components/ui/button`; no API changes required
- [X] T012 [P] [US1] Migrate `frontend/src/pages/LoginPage.tsx` — update imports to use `@/components/ui/button`, `@/components/ui/card`, `@/components/ui/input`, `@/components/ui/label`; no API changes required for these components
- [X] T013 [P] [US1] Migrate `frontend/src/pages/DashboardPage.tsx` — update Badge import to `@/components/ui/badge` (map `success` variant → `secondary`, `danger` → `destructive`, `warning` → `warning`); update Card to `@/components/ui/card`; replace `DataTable` wrapper with `Table`, `TableHeader`, `TableBody`, `TableRow`, `TableHead`, `TableCell` from `@/components/ui/table`
- [X] T014 [P] [US1] Migrate `frontend/src/pages/ClassifierPage.tsx` — update Button, Card, Label imports to per-component paths; replace `DataTable` with shadcn/ui Table primitives from `@/components/ui/table`; replace custom `Select` with compound `Select`, `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectItem` from `@/components/ui/select` (see contracts/ui-components.md for before/after API)
- [X] T015 [P] [US1] Migrate `frontend/src/pages/TransactionsPage.tsx` — identify all imports from `@/components/ui`; update each to per-component paths; replace `DataTable` with shadcn/ui Table primitives from `@/components/ui/table`
- [X] T016 [P] [US1] Migrate `frontend/src/pages/AccountsPage.tsx` — update Button, Card, Input, Label to per-component paths; replace custom `Modal` (isOpen/onClose API) with `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `@/components/ui/dialog` (see contracts/ui-components.md for before/after API); replace custom `Select` with compound Select from `@/components/ui/select`
- [X] T017 [P] [US1] Migrate `frontend/src/pages/ProfilePage.tsx` — update Button, Card, Input, Label to per-component paths; replace custom `Modal` with `Dialog`, `DialogContent`, `DialogHeader`, `DialogTitle`, `DialogFooter` from `@/components/ui/dialog`
- [X] T018 [US1] Delete `frontend/src/components/ui.tsx` — only after ALL page migrations (T011–T017) are verified to compile; confirm no remaining imports reference `@/components/ui` as a file (run `grep -r "@/components/ui\"" frontend/src` — must return zero results)
- [X] T019 [US1] Run `pnpm test` in `frontend/` and verify all interaction tests pass (T008, T009, T010); fix any failures before proceeding

**Checkpoint**: User Story 1 complete — all pages use official shadcn/ui components, `ui.tsx` is deleted, all interaction tests pass

---

## Phase 4: User Story 2 - Adopt Canonical shadcn/ui Project Structure (Priority: P2)

**Goal**: Project structure is verifiably canonical — components in the right location, `components.json` correct, future `shadcn add` workflow works

**Independent Test**: Run `pnpm dlx shadcn@latest add tooltip` in `frontend/` — the file appears at `frontend/src/components/ui/tooltip.tsx` with no configuration changes needed; then delete it

- [X] T020 [US2] Verify `frontend/components.json` is correctly configured — check that `aliases.components` points to `@/components/ui` and `aliases.utils` points to `@/lib/utils`; adjust if `shadcn init` generated different values
- [X] T021 [US2] Audit `frontend/src/components/ui/` — confirm it contains exactly the 8 shadcn/ui generated files (button.tsx, input.tsx, label.tsx, card.tsx, badge.tsx, select.tsx, dialog.tsx, table.tsx) and no leftover custom files; confirm `frontend/src/components/` contains only `Layout.tsx` and `ProtectedRoute.tsx` (and `ui/`)
- [X] T022 [US2] Smoke-test the shadcn/ui add workflow — run `pnpm dlx shadcn@latest add tooltip` in `frontend/`, verify the file lands at `frontend/src/components/ui/tooltip.tsx`, then delete it to keep scope clean
- [X] T023 [US2] Run `pnpm build` in `frontend/` — verify zero TypeScript errors and zero lint errors; fix any path alias or import issues found

**Checkpoint**: User Story 2 complete — project structure is canonical and the `shadcn add` workflow works without custom setup

---

## Phase 5: User Story 3 - Visual Consistency After Migration (Priority: P3)

**Goal**: Every page visually matches the pre-migration design; any intentional deviations are noted

**Independent Test**: Open each page in the browser with both light and dark themes; confirm no broken layouts, missing styling, or unexpected visual changes

- [X] T024 [US3] Review DashboardPage visually — verify Badge color variants (income/expense/warning) render correctly with the new shadcn/ui Badge and custom warning variant; confirm Card and Table layout is unchanged
- [X] T025 [US3] Review AccountsPage and ProfilePage visually — verify Dialog (formerly Modal) renders correctly with proper backdrop, title, and body; verify Select dropdown opens and displays options; test in both light and dark modes
- [X] T026 [US3] Review LoginPage, ClassifierPage, and TransactionsPage visually — verify Button variants (default, outline, destructive) match pre-migration appearance; verify Table layout matches previous DataTable; test dark mode
- [X] T027 [US3] Fix any visual regressions identified in T024–T026 — document intentional deviations (e.g., shadcn/ui default spacing differs slightly from custom) in a comment at the top of the affected component file

**Checkpoint**: User Story 3 complete — all pages visually consistent; any deviations are intentional and documented

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Final cleanup, validation, and constitution amendment

- [X] T028 [P] Remove the Testing Library setup import from `frontend/src/main.tsx` or any production file if it was accidentally placed there — verify `frontend/tests/setup.ts` is the only file importing `@testing-library/jest-dom`
- [X] T029 [P] Update `frontend/README.md` or equivalent developer docs (if any) to document the new `pnpm dlx shadcn@latest add <component>` workflow for adding components; link to `specs/004-shadcn-migration/quickstart.md`
- [X] T030 Run `pnpm test` in `frontend/` one final time — confirm all tests green; run `pnpm build` — confirm no TypeScript or build errors
- [X] T031 Amend `.specify/memory/constitution.md` — in the Technology Constraints table change the Frontend row from `React + TypeScript + Tailwind CSS + shadcn-style components` to `React + TypeScript + Tailwind CSS + shadcn/ui`; increment version from 1.1.1 to 1.1.2; update `Last Amended` to today's date (2026-04-06); commit with message `docs: amend constitution v1.1.2 — update frontend tech table to shadcn/ui`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 — **BLOCKS all user story work**
- **US1 (Phase 3)**: Depends on Phase 2 — write tests first, then implement
- **US2 (Phase 4)**: Depends on Phase 3 (US1 must be complete before structural audit)
- **US3 (Phase 5)**: Depends on Phase 3 (pages must be migrated before visual review)
- **Polish (Phase 6)**: Depends on Phases 3, 4, 5 all complete

### User Story Dependencies

- **US1 (P1)**: Can start after Phase 2 — no dependency on US2 or US3
- **US2 (P2)**: Logically follows US1 (validates the structure US1 created)
- **US3 (P3)**: Can run concurrently with US2 after US1 — independent verification track

### Within User Story 1

- T008, T009, T010 (tests) — write in parallel, must FAIL before T011–T017
- T011–T017 (page migrations) — can all run in parallel (separate files)
- T018 (delete ui.tsx) — must wait for ALL T011–T017 to compile
- T019 (test run) — must wait for T018

---

## Parallel Example: User Story 1

```bash
# Write all tests in parallel (T008, T009, T010):
Task: "Write LoginPage interaction test in frontend/tests/LoginPage.test.tsx"
Task: "Write AccountsPage interaction test in frontend/tests/AccountsPage.test.tsx"
Task: "Write ProfilePage interaction test in frontend/tests/ProfilePage.test.tsx"

# Migrate all pages in parallel (T011-T017) after Phase 2 completes:
Task: "Migrate frontend/src/components/Layout.tsx"
Task: "Migrate frontend/src/pages/LoginPage.tsx"
Task: "Migrate frontend/src/pages/DashboardPage.tsx"
Task: "Migrate frontend/src/pages/ClassifierPage.tsx"
Task: "Migrate frontend/src/pages/TransactionsPage.tsx"
Task: "Migrate frontend/src/pages/AccountsPage.tsx"
Task: "Migrate frontend/src/pages/ProfilePage.tsx"
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup
2. Complete Phase 2: Foundational (CRITICAL — generates component files)
3. Write tests (T008–T010) — verify they fail
4. Complete Phase 3: User Story 1 — migrate all pages
5. **STOP and VALIDATE**: `pnpm test` passes, `pnpm build` passes, all pages open in browser

### Incremental Delivery

1. Complete Setup + Foundational → shadcn/ui components available
2. Complete US1 → All pages migrated, tests passing (MVP ✓)
3. Complete US2 → Structure verified, `shadcn add` workflow confirmed
4. Complete US3 → Visual review done, regressions fixed
5. Complete Polish → Tests green, constitution amended, branch ready to merge

---

## Notes

- `[P]` tasks work on different files with no cross-dependencies
- `[Story]` label maps each task to the user story for traceability
- The high-complexity migrations are AccountsPage (T016) and ClassifierPage (T014) — both involve the breaking Select and Dialog/Modal API changes documented in `contracts/ui-components.md`
- T018 (delete ui.tsx) is the key milestone confirming the migration is complete
- T031 (constitution amendment) is a mandatory final deliverable per FR-008 — the branch must not merge without it
