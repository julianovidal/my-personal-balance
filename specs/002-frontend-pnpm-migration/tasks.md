# Tasks: Frontend pnpm Migration

**Input**: Design documents from `/specs/002-frontend-pnpm-migration/`  
**Prerequisites**: plan.md ✅ spec.md ✅ research.md ✅ quickstart.md ✅

**Organization**: Tasks are grouped by user story to enable independent implementation and testing of each story.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1–US4)

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Declare pnpm as the package manager so Corepack and all subsequent steps know which version to use.

- [x] T001 Add `"packageManager": "pnpm@<version>"` field to `frontend/package.json` — run `pnpm --version` after local install to get the exact version string

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Constitution amendment and package manager field must be in place before lockfile generation and Docker changes.

**⚠️ CRITICAL**: No user story work can begin until this phase is complete.

- [x] T002 Amend `.specify/memory/constitution.md` — in §Technology Constraints, replace `package-lock.json` with `pnpm-lock.yaml` and note pnpm as the Node package manager; bump version to `1.0.1` and update `Last Amended` to today

**Checkpoint**: Foundation ready — user story implementation can now begin.

---

## Phase 3: User Story 1 — Developer installs dependencies with pnpm (Priority: P1) 🎯 MVP

**Goal**: Replace the npm lockfile with a pnpm lockfile so `pnpm install` is the canonical way to install frontend dependencies.

**Independent Test**: Delete `frontend/node_modules`, run `pnpm install` inside `frontend/`, confirm zero errors, `pnpm-lock.yaml` exists, and `package-lock.json` is gone.

### Implementation for User Story 1

- [x] T003 [US1] Run `pnpm import` inside `frontend/` to generate `frontend/pnpm-lock.yaml` from the existing `frontend/package-lock.json` — verify all packages resolved without errors
- [x] T004 [US1] Delete `frontend/package-lock.json` from the repository (`git rm frontend/package-lock.json`)
- [x] T005 [US1] Verify clean install: delete `frontend/node_modules`, run `pnpm install --frozen-lockfile` inside `frontend/`, confirm zero errors

**Checkpoint**: `pnpm install` works. `package-lock.json` is gone. User Story 1 is independently testable.

---

## Phase 4: User Story 2 — Developer runs local development server with pnpm (Priority: P2)

**Goal**: Confirm the existing `dev` script works when invoked via pnpm, with no changes to `package.json` scripts.

**Independent Test**: Run `pnpm run dev` inside `frontend/`, verify Vite starts and the app is reachable at `http://localhost:5173`.

### Implementation for User Story 2

- [x] T006 [US2] Smoke-test the dev server: run `pnpm run dev` inside `frontend/`, open `http://localhost:5173`, confirm the application loads and hot-module replacement is functional — no code changes expected; this task is a verification gate

**Checkpoint**: Dev server starts correctly via pnpm. User Story 2 is independently testable.

---

## Phase 5: User Story 3 — Docker image builds and runs with pnpm (Priority: P3)

**Goal**: Update `frontend/Dockerfile` to use pnpm instead of npm, and verify the full `podman-compose` stack builds and runs cleanly.

**Independent Test**: `podman-compose -f podman-compose.yml up --build` completes without errors and `http://localhost:5173` responds.

### Implementation for User Story 3

- [x] T007 [US3] Update `frontend/Dockerfile`: add `RUN corepack enable pnpm` after the `FROM` line, replace `RUN npm install` with `RUN pnpm install --frozen-lockfile`, replace `CMD ["npm", "run", "dev"]` with `CMD ["pnpm", "run", "dev"]`
- [x] T008 [US3] Build and run the updated image locally: `podman build -t balance-frontend frontend/` — confirm build succeeds with no errors and pnpm is used for installation
- [x] T009 [US3] Run the full stack: `podman-compose -f podman-compose.yml up --build` from the project root — confirm all services start healthy and `http://localhost:5173` responds

**Checkpoint**: Docker/Podman workflow works end-to-end. User Story 3 is independently testable.

---

## Phase 6: User Story 4 — AGENTS.md documents pnpm (Priority: P4)

**Goal**: Update `frontend/AGENTS.md` so future agents and developers use pnpm and not npm.

**Independent Test**: Read `frontend/AGENTS.md` — pnpm is the stated package manager, setup instructions reference pnpm, zero npm commands remain.

### Implementation for User Story 4

- [x] T010 [US4] Rewrite `frontend/AGENTS.md`: add a Package Manager section documenting pnpm as the official package manager, include `corepack enable pnpm` as the setup step, list common commands (`pnpm install`, `pnpm run dev`, `pnpm run build`), and remove any npm references

**Checkpoint**: AGENTS.md accurately reflects pnpm. User Story 4 is independently testable.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: Final scan and smoke test to confirm migration is complete with no npm remnants.

- [x] T011 [P] Scan `frontend/` for any remaining npm references: check `frontend/Dockerfile`, `frontend/AGENTS.md`, and any other config files for `npm install`, `npm run`, or `package-lock.json` — fix any occurrences found
- [x] T012 Run the full smoke test checklist from `specs/002-frontend-pnpm-migration/quickstart.md` — all five checkboxes must pass before the branch is considered complete

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately
- **Foundational (Phase 2)**: Depends on Phase 1 (T001 must be done before T002) — **blocks all user stories**
- **User Story phases (3–6)**: All depend on Foundational completion
  - US1 (Phase 3) must complete before US2, US3 (lockfile must exist for Docker build)
  - US2 (Phase 4) can start independently of US3/US4 once US1 is done
  - US3 (Phase 5) and US4 (Phase 6) can run in parallel after US1
- **Polish (Phase 7)**: Depends on all user story phases complete

### User Story Dependencies

- **US1 (P1)**: Starts after Foundational — no story dependencies
- **US2 (P2)**: Starts after US1 (needs the lockfile to exist)
- **US3 (P3)**: Starts after US1 (Dockerfile needs `pnpm-lock.yaml` to be present for `--frozen-lockfile`)
- **US4 (P4)**: Starts after Foundational — independent of US1/US2/US3

### Parallel Opportunities

- T007 (Dockerfile update) and T010 (AGENTS.md update) can run in parallel — different files
- T008 + T009 are sequential (build before compose)

---

## Parallel Example: US3 + US4

```text
# After US1 is complete, these can run in parallel:

Developer / Agent A — US3:
  T007: Update frontend/Dockerfile
  T008: podman build verification
  T009: podman-compose up --build verification

Developer / Agent B — US4 (simultaneously):
  T010: Rewrite frontend/AGENTS.md
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Setup (T001)
2. Complete Phase 2: Foundational (T002)
3. Complete Phase 3: US1 (T003–T005)
4. **STOP and VALIDATE**: `pnpm install` works, lockfile is correct, `package-lock.json` gone

### Incremental Delivery

1. Setup + Foundational → T001, T002
2. US1 → pnpm local install works (MVP)
3. US2 → dev server confirmed via pnpm
4. US3 → Docker/Podman workflow confirmed
5. US4 → AGENTS.md updated
6. Polish → clean scan + full smoke test

---

## Notes

- [P] tasks = different files, no blocking dependencies
- Run `pnpm --version` after enabling pnpm to fill in the exact version for the `packageManager` field in T001
- `pnpm import` (T003) is preferred over cold `pnpm install` to preserve exact resolved versions from the existing `package-lock.json`
- If `pnpm import` fails or produces resolution errors, fall back to `pnpm install` and commit the result
- Commit after each checkpoint to keep the branch history clean and each story independently reviewable
