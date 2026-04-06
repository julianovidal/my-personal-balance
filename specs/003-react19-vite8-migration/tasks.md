# Tasks: Migrate Frontend to React 19 and Vite 8

**Input**: Design documents from `/specs/003-react19-vite8-migration/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- No tests requested — test tasks are omitted

---

## Phase 1: Setup (Baseline Verification)

**Purpose**: Confirm the app builds and runs correctly before any changes. Establishes a known-good baseline.

- [x] T001 Verify the development server starts and all pages load by running `pnpm dev` in `frontend/` (baseline: no pre-existing errors)
- [x] T002 Verify the production build succeeds by running `pnpm build` in `frontend/` (baseline: clean build before migration)

---

## Phase 2: Foundational (Pre-Upgrade Codemods)

**Purpose**: Run automated codemods and manual fixes that must be applied BEFORE version bumps to correctly identify deprecated patterns in the current React 18 codebase.

**⚠️ CRITICAL**: These tasks must complete before any dependency version changes in Phase 3.

- [x] T003 Run the React 19 migration codemod from `frontend/`: `npx codemod@latest react/19/migration-recipe` (automates forwardRef, propTypes, and other removals — no-op if nothing applies)
- [x] T004 Fix `JSX.Element` global namespace reference in `frontend/src/components/ProtectedRoute.tsx` line 4: replace `children: JSX.Element` with `children: React.ReactNode` (global `JSX` namespace is removed in React 19)

**Checkpoint**: Codebase is clean of React 18 deprecated patterns — version bumps can now proceed

---

## Phase 3: User Story 1 — Application Runs on React 19 + Vite 8 (Priority: P1) 🎯 MVP

**Goal**: Update all dependency versions, reinstall, and confirm the app builds and runs without errors on React 19.2.4 and Vite 8.0.3.

**Independent Test**: Run `pnpm build` and `pnpm dev` in `frontend/` — both complete without errors and all pages are accessible.

### Implementation for User Story 1

- [x] T005 [US1] Update `dependencies` in `frontend/package.json`: set `react` to `^19.2.4`, `react-dom` to `^19.2.4`, `lucide-react` to `^1.7.0`
- [x] T006 [US1] Update `devDependencies` in `frontend/package.json`: set `vite` to `^8.0.3`, `@vitejs/plugin-react` to `^6.0.1`, `@types/react` to `^19.0.0`, `@types/react-dom` to `^19.0.0`; also remove `"esbuild"` from `pnpm.onlyBuiltDependencies` (Vite 8 no longer depends on esbuild)
- [x] T007 [US1] Run `pnpm install` in `frontend/` to resolve and install the updated dependencies, regenerating `frontend/pnpm-lock.yaml`
- [x] T008 [US1] Run the React types codemod from `frontend/`: `npx types-react-codemod@latest preset-19 ./src` (fixes `@types/react@19` breaking changes: ref callbacks, `useRef` argument, etc. — no-op if nothing applies)
- [x] T009 [US1] Run `pnpm build` in `frontend/` and fix any TypeScript compilation errors surfaced by `@types/react@19` (e.g., `useRef` argument, ref callback return type, `ReactElement` props typed as `unknown`)
- [x] T010 [US1] Start the development server with `pnpm dev` in `frontend/` and confirm the app loads at `http://localhost:5173` without browser console errors

**Checkpoint**: User Story 1 is complete — React 19 and Vite 8 are installed, the app builds and runs

---

## Phase 4: User Story 2 — No Regressions in Existing Functionality (Priority: P2)

**Goal**: Verify that no existing application functionality was broken by the dependency upgrade.

**Independent Test**: Navigate all application pages — Dashboard, Accounts, Transactions, Classifier, Profile, Login — with no runtime errors, blank screens, or broken interactions.

**Note**: The codebase has no automated test suite. Verification is manual for this migration. The spec's "100% of previously passing tests pass" requirement is vacuously satisfied (zero tests = zero failures).

### Implementation for User Story 2

- [x] T011 [US2] Navigate all pages in the running dev server and verify correct rendering: Dashboard (`/`), Accounts, Transactions, Classifier, Profile, and Login pages
- [x] T012 [US2] Verify the browser console shows no React deprecation warnings (e.g., no `forwardRef` deprecation notices, no removed-API errors) after navigating all pages

**Checkpoint**: User Story 2 complete — all pages render correctly with no regressions

---

## Phase 5: User Story 3 — Developer Tooling Works Correctly (Priority: P3)

**Goal**: Confirm that Vite 8's Hot Module Replacement and error overlay work correctly during development.

**Independent Test**: Edit a component file while the dev server is running — the browser updates without a full page reload.

### Implementation for User Story 3

- [x] T013 [US3] Verify HMR: with the dev server running, make a trivial visual change to `frontend/src/components/Layout.tsx` (e.g., add a temporary CSS class) and confirm the browser updates without a full reload; then revert the change
- [x] T014 [US3] Verify the Vite 8 error overlay: temporarily introduce a syntax error in `frontend/src/App.tsx`, confirm a meaningful error message appears in the browser overlay, then revert

**Checkpoint**: User Story 3 complete — Vite 8 HMR and error overlay work as expected

---

## Phase 6: Polish & Documentation

**Purpose**: Update documentation to reflect the new versions, and run a final end-to-end build verification.

- [x] T015 [P] Update `frontend/AGENTS.md`: change `React 18` to `React 19` and `Vite 7` to `Vite 8` in the Project Specification section
- [x] T016 [P] Update `CLAUDE.md` Active Technologies section: update the React and Vite version entries added by the agent context script to reflect React 19 and Vite 8
- [x] T017 Run final production build and preview from `frontend/`: `pnpm build && pnpm preview` — confirm the production bundle serves all pages without errors at `http://localhost:5173`

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 completion — BLOCKS Phase 3
- **User Story 1 (Phase 3)**: Depends on Phase 2 — core upgrade work
- **User Story 2 (Phase 4)**: Depends on Phase 3 — regression verification requires the upgraded app to run
- **User Story 3 (Phase 5)**: Depends on Phase 3 — HMR verification requires Vite 8 to be installed
- **Polish (Phase 6)**: Depends on Phases 4 and 5

### User Story Dependencies

- **US1 (P1)**: Depends on Foundational phase (codemods) only
- **US2 (P2)**: Depends on US1 (requires upgraded app to navigate)
- **US3 (P3)**: Depends on US1 (requires Vite 8 installed); can run in parallel with US2

### Within Each Phase

- T005 and T006 are edits to the same file (`package.json`) — execute sequentially
- T007 (`pnpm install`) depends on T005 and T006 completing
- T008 depends on T007 (types codemod needs new @types/react installed)
- T009 depends on T008 (TypeScript fixes may surface from codemod output)
- T015 and T016 are edits to different files — can run in parallel

### Parallel Opportunities

- T001 and T002 (Phase 1): Can run in parallel — different commands, independent verification
- T011 and T012 (Phase 4): Can run sequentially or together (same session)
- T013 and T014 (Phase 5): Can run sequentially (same dev session)
- T015 and T016 (Phase 6): Can run in parallel — different files

---

## Parallel Example: User Story 1

```bash
# T005 and T006 both edit package.json — run sequentially:
Task T005: Update dependencies block (react, react-dom, lucide-react)
Task T006: Update devDependencies block (vite, plugin-react, @types/*)

# T009 may produce multiple TypeScript errors — can be fixed simultaneously in different files:
Task T009a: Fix any ref callback return type errors across src/
Task T009b: Fix any useRef argument errors across src/
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Baseline verification
2. Complete Phase 2: Foundational codemods (CRITICAL — blocks upgrade)
3. Complete Phase 3: User Story 1 (dependency upgrade + build verification)
4. **STOP and VALIDATE**: `pnpm build` succeeds, `pnpm dev` loads the app
5. This alone delivers the migration value

### Incremental Delivery

1. Phase 1 + 2: Baseline + codemods → codebase ready for upgrade
2. Phase 3: Upgrade complete → app builds on React 19 + Vite 8 (MVP)
3. Phase 4: Regression verification → confidence all pages work
4. Phase 5: Tooling verification → dev experience confirmed
5. Phase 6: Documentation updated → migration fully closed out

---

## Notes

- **No tests generated** — the spec does not request TDD and no test framework exists
- **3 files changed** in total: `frontend/package.json`, `frontend/pnpm-lock.yaml`, `frontend/src/components/ProtectedRoute.tsx`
- `vite.config.ts` and `tsconfig.json` require **zero changes**
- `frontend/Dockerfile` requires **zero changes** (uses Node 22 which supports both React 19 and Vite 8)
- After T007 (`pnpm install`), commit both `package.json` and `pnpm-lock.yaml` together
- If T009 surfaces unexpected TypeScript errors beyond the known `JSX.Element` fix, consult `research.md` Decision 5 for context
- React 19 target **must** be `^19.2.4` — do not accept `^19.0.0` (CVE-2025-55182 affects 19.0.0–19.2.2)
