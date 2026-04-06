---
description: "Task list for fix: Radix UI Select import error in OCI container"
---

# Tasks: Fix Radix UI Select Import Error in OCI Container

**Input**: Design documents from `/specs/005-fix-radix-select-import/`  
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Scope**: 2 config file changes (1 new file, 1 modified file) + manual validation steps. No source code changes. No automated tests required — this is a container config fix; acceptance is manual container verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to

---

## Phase 1: Setup (One-Time Volume Cleanup)

**Purpose**: Remove the stale anonymous OCI volume that contains the outdated `node_modules` without `@radix-ui/react-select`. This must happen before rebuilding so the new named volume is populated cleanly from the rebuilt image.

- [x] T001 Stop all running containers and remove volumes with `podman-compose down -v` from the project root

**Checkpoint**: No running containers or volumes from previous builds remain

---

## Phase 2: Implementation (US1 Config Changes)

**Purpose**: Apply the two configuration changes that fix the root cause — pnpm's isolated symlink linker and the stale anonymous volume.

**⚠️ T002 and T003 touch different files and can be applied in parallel.**

- [x] T002 [P] [US1] Create `frontend/.npmrc` with content `node-linker=hoisted` to switch pnpm from symlink-based to flat node_modules layout
- [x] T003 [P] [US1] Update `podman-compose.yml` frontend service: replace anonymous volume entry `/app/node_modules` with named volume entry `frontend_node_modules:/app/node_modules`, and add `frontend_node_modules:` declaration under the top-level `volumes:` block

**Checkpoint**: Both files modified — ready for container rebuild and validation

---

## Phase 3: User Story 1 — Container Page Loads Without Errors (Priority: P1) 🎯 MVP

**Goal**: The frontend container serves pages with the Select component without import resolution errors.

**Independent Test**: Build the container image, start the container, open `http://localhost:5173` in a browser, navigate to a page using the Select component, and confirm no `Failed to resolve import "@radix-ui/react-select"` error appears in the browser console.

### Validation for User Story 1

- [x] T004 [US1] Rebuild and start the container stack with `podman-compose up --build` from the project root and confirm the frontend container starts without Vite import errors in the terminal output
- [x] T005 [US1] Open `http://localhost:5173` in a browser, navigate to a page that renders the Select component, and verify the page loads with no import resolution errors in the browser console (F12 → Console)
- [x] T006 [US1] Interact with the Select component: open the dropdown, select an option, and confirm the selection is reflected — verifying the component is fully functional inside the container

**Checkpoint**: User Story 1 complete — container serves Select component pages without errors

---

## Phase 4: User Story 2 — Local Development Unaffected (Priority: P2)

**Goal**: The `node-linker=hoisted` change in `.npmrc` does not break local development.

**Independent Test**: Delete the local `node_modules`, run `pnpm install`, start `pnpm run dev`, navigate to a page with the Select component, and confirm it works with no console errors.

### Validation for User Story 2

- [x] T007 [US2] In `frontend/`, delete the local `node_modules` directory and run `pnpm install` to produce a fresh hoisted-layout `node_modules` locally
- [x] T008 [US2] Run `pnpm run dev` locally, open `http://localhost:5173`, navigate to a page using the Select component, and confirm no import errors appear in the browser console

**Checkpoint**: User Story 2 complete — local development works identically after the pnpm linker change

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: Agent context update and verification that the CLAUDE.md prohibition is enforced.

- [x] T009 [P] Run `.specify/scripts/bash/update-agent-context.sh opencode` from the project root to update `AGENTS.md` with the feature entry (NOT claude — see spec FR-007)
- [x] T010 [P] Confirm `CLAUDE.md` does not exist in the project root (`ls CLAUDE.md` should return "No such file or directory")

**Checkpoint**: All tasks complete — fix verified in container and locally, agent context updated correctly

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Cleanup)**: No dependencies — start immediately
- **Phase 2 (Implementation)**: Depends on Phase 1 completion (volume must be gone before rebuild)
- **Phase 3 (US1 Validation)**: Depends on Phase 2 completion
- **Phase 4 (US2 Validation)**: Can run in parallel with Phase 3 (different environment — local vs container)
- **Phase 5 (Polish)**: Depends on Phases 3 and 4 passing

### User Story Dependencies

- **US1 (P1)**: Container validation — depends on T001, T002, T003
- **US2 (P2)**: Local dev validation — depends on T002 only (`.npmrc` change); can overlap with US1

### Parallel Opportunities

- T002 and T003 touch different files → can be applied in parallel
- Phase 4 (US2 local validation) can run in parallel with Phase 3 (US1 container validation) on different machines or after Phase 2 completes
- T009 and T010 in Phase 5 are independent

---

## Parallel Example: Phase 2

```text
# Apply config changes in parallel (different files):
Task T002: Create frontend/.npmrc with node-linker=hoisted
Task T003: Update podman-compose.yml (volumes section)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1: Volume cleanup (`podman-compose down -v`)
2. Complete Phase 2: Apply T002 + T003 in parallel
3. Complete Phase 3: Rebuild and validate container (T004 → T005 → T006)
4. **STOP and VALIDATE**: Container serves Select component without errors
5. Proceed to Phase 4 to confirm no local regressions

### Incremental Delivery

1. Phase 1 + Phase 2 → Config changes in place
2. Phase 3 → Container validated (US1 done, fix confirmed)
3. Phase 4 → Local dev confirmed unaffected (US2 done)
4. Phase 5 → Housekeeping complete

---

## Notes

- [P] tasks = different files, no dependencies between them
- No automated tests are added — this is a container config fix; the spec's constitution check confirms manual acceptance testing is sufficient
- `pnpm-lock.yaml` must NOT change — `node-linker=hoisted` only affects how packages are laid out on disk, not the lockfile format
- After T001, the `podman-compose down -v` also removes `balance_pg_data` — the database will be empty on next startup; seed or restore data if needed
- Reference: [quickstart.md](quickstart.md) for detailed verification steps and troubleshooting
