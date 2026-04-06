---
description: "Task list for migrating backend and classifier Python services to uv"
---

# Tasks: Migrate Python Services to uv Package Manager

**Input**: Design documents from `specs/001-migrate-python-uv/`
**Prerequisites**: plan.md ✅, spec.md ✅, research.md ✅, quickstart.md ✅

**Tests**: No test tasks generated — spec does not request TDD; validation is
done via container health checks and smoke tests as defined in the acceptance
scenarios.

**Organization**: Tasks are grouped by user story to enable independent
implementation and testing of each story.

## Format: `[ID] [P?] [Story?] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (US1, US2, US3)
- Exact file paths included in each description

## Path Conventions

- **Backend**: `backend/`
- **Classifier**: `classifier/`
- Paths are relative to repository root

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Create project declaration files and generate lock files for both
services. These artifacts are required before either service Dockerfile can be
updated.

- [x] T001 Verify uv is installed locally (`uv --version`); install if absent
  following `specs/001-migrate-python-uv/quickstart.md`
- [x] T002 [P] Create `backend/pyproject.toml` with `[project]` section and all
  14 pinned dependencies ported exactly from `backend/requirements.txt`
  (fastapi, uvicorn, sqlalchemy, alembic, psycopg2-binary, pydantic,
  pydantic-settings, python-jose, passlib, bcrypt, python-multipart, pandas,
  openpyxl, email-validator); set `requires-python = ">=3.12"`
- [x] T003 [P] Create `classifier/pyproject.toml` with `[project]` section and
  all 10 pinned dependencies ported exactly from `classifier/requirements.txt`
  (fastapi, uvicorn, sqlalchemy, psycopg2-binary, pydantic, pydantic-settings,
  python-jose, scikit-learn, joblib, numpy); set `requires-python = ">=3.12"`
- [x] T004 Generate `backend/uv.lock` by running `uv lock` inside `backend/`;
  commit `backend/pyproject.toml` and `backend/uv.lock` together
- [x] T005 [P] Generate `classifier/uv.lock` by running `uv lock` inside
  `classifier/`; commit `classifier/pyproject.toml` and `classifier/uv.lock`
  together

> **Note**: T002 and T003 are parallel. T004 and T005 are parallel with each
> other but each depends on its own pyproject.toml being complete (T004→T002,
> T005→T003).

**Checkpoint**: Both `pyproject.toml` and `uv.lock` files exist and are committed
for both services — user story implementation can now begin.

---

## Phase 2: Foundational (Blocking Prerequisites)

No additional foundational tasks beyond Phase 1. The pyproject.toml + uv.lock
artifacts produced in Phase 1 are the only shared prerequisites.

---

## Phase 3: User Story 1 — Backend Service Runs with uv-Managed Dependencies (Priority: P1) 🎯 MVP

**Goal**: The backend container builds and starts using uv; `requirements.txt`
is removed.

**Independent Test**: `podman-compose build backend && podman-compose up backend`
completes without errors and `curl http://localhost:8000/health` returns HTTP 200.

### Implementation for User Story 1

- [x] T006 [US1] Update `backend/Dockerfile`: replace the `pip install` line with
  the uv binary copy and `uv sync` pattern — add
  `COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv`, set
  `ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/venv`,
  replace `COPY requirements.txt .` and `RUN pip install --no-cache-dir -r requirements.txt`
  with `COPY pyproject.toml uv.lock ./` and `RUN uv sync --frozen --no-cache`,
  then `ENV PATH="/venv/bin:$PATH"`
- [x] T007 [US1] Build the backend container image:
  `podman-compose build backend` — confirm build exits 0 with no errors
- [x] T008 [US1] Start the backend service: `podman-compose up backend` (with
  the database service) — confirm `curl http://localhost:8000/health` returns
  HTTP 200
- [x] T009 [US1] Smoke test backend API endpoints: verify login
  (`POST /api/auth/login`), accounts list (`GET /api/accounts`), and transactions
  list (`GET /api/transactions`) all respond correctly
- [x] T010 [US1] Delete `backend/requirements.txt` and commit the removal
  alongside the updated `backend/Dockerfile`

**Checkpoint**: User Story 1 complete — backend container builds and runs with
uv, legacy file removed, all endpoints functional.

---

## Phase 4: User Story 2 — Classifier Service Runs with uv-Managed Dependencies (Priority: P2)

**Goal**: The classifier container builds and starts using uv; `requirements.txt`
is removed.

**Independent Test**: `podman-compose build classifier && podman-compose up
classifier` completes without errors and `curl http://localhost:8001/health`
returns HTTP 200.

### Implementation for User Story 2

- [x] T011 [US2] Update `classifier/Dockerfile`: apply the same uv binary copy
  and `uv sync` pattern as T006 — add
  `COPY --from=ghcr.io/astral-sh/uv:latest /uv /bin/uv`, set
  `ENV UV_COMPILE_BYTECODE=1 UV_LINK_MODE=copy UV_PROJECT_ENVIRONMENT=/venv`,
  replace `COPY requirements.txt .` and `RUN pip install --no-cache-dir -r requirements.txt`
  with `COPY pyproject.toml uv.lock ./` and `RUN uv sync --frozen --no-cache`,
  then `ENV PATH="/venv/bin:$PATH"`
- [x] T012 [US2] Build the classifier container image:
  `podman-compose build classifier` — confirm build exits 0 with no errors
- [x] T013 [US2] Start the classifier service: `podman-compose up classifier`
  (with the database service) — confirm `curl http://localhost:8001/health`
  returns HTTP 200
- [x] T014 [US2] Delete `classifier/requirements.txt` and commit the removal
  alongside the updated `classifier/Dockerfile`

**Checkpoint**: User Story 2 complete — classifier container builds and runs with
uv, legacy file removed, service healthy.

---

## Phase 5: User Story 3 — Developer Documentation Reflects uv Workflow (Priority: P3)

**Goal**: Both AGENTS.md files accurately describe the uv-based workflow with
no references to the old pip/requirements.txt approach.

**Independent Test**: A developer follows only the AGENTS.md instructions and
successfully installs dependencies and starts each service without additional
guidance.

### Implementation for User Story 3

- [x] T015 [US3] Update `backend/AGENTS.md`: replace or add a "Dependency
  Management" section documenting `uv sync` for local install, `uv add` for
  new packages, `uv run` for executing scripts, and note that `uv.lock` must
  be committed; remove any pip/requirements.txt references
- [x] T016 [P] [US3] Update `classifier/AGENTS.md`: apply the same documentation
  updates as T015 — `uv sync`, `uv add`, `uv run`, lock file commit requirement,
  no pip/requirements.txt references

**Checkpoint**: All three user stories complete — both services migrated and
documented.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Full-stack validation and final commit hygiene.

- [x] T017 Validate full application stack: `podman-compose -f podman-compose.yml
  up --build` from project root — confirm all services (backend, classifier,
  frontend, database) start successfully and all health endpoints return HTTP 200
- [x] T018 [P] Confirm no `requirements.txt` files remain anywhere in `backend/`
  or `classifier/` (run `find backend classifier -name requirements.txt` — expect
  no output)
- [x] T019 [P] Confirm `uv.lock` and `pyproject.toml` are staged for both
  services (run `git status`)
- [x] T020 Review `specs/001-migrate-python-uv/quickstart.md` and confirm all
  commands in the "Daily Workflows" section work as documented

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately; T002 and T003
  parallel; T004 and T005 parallel after their respective pyproject.toml
- **Foundational (Phase 2)**: None — skipped
- **US1 (Phase 3)**: Depends on T002 + T004 (backend pyproject.toml + lock)
- **US2 (Phase 4)**: Depends on T003 + T005 (classifier pyproject.toml + lock);
  can start in parallel with US1 if team capacity allows
- **US3 (Phase 5)**: Depends on US1 and US2 being complete (documentation must
  reflect validated behavior)
- **Polish (Phase 6)**: Depends on all user stories complete

### User Story Dependencies

- **US1 (P1)**: Depends on Phase 1 — no dependency on US2
- **US2 (P2)**: Depends on Phase 1 — no dependency on US1 (fully independent)
- **US3 (P3)**: Depends on US1 and US2 both complete

### Within Each User Story

- pyproject.toml and uv.lock (Phase 1) → Dockerfile update → Build → Health
  check → Smoke test → Delete legacy file

### Parallel Opportunities

- T002 and T003: Create pyproject.toml for both services simultaneously
- T004 and T005: Generate lock files for both services simultaneously
- T006–T010 (US1) and T011–T014 (US2): Entire story phases can run in parallel
  (separate services, no shared files)
- T015 and T016: AGENTS.md updates for both services simultaneously
- T018 and T019: Final verification checks in parallel

---

## Parallel Example: Phases 3 + 4 (Two Engineers)

```bash
# Engineer A — User Story 1 (backend):
Task: "Update backend/Dockerfile to use uv binary copy pattern" (T006)
Task: "Build backend container: podman-compose build backend" (T007)
Task: "Validate backend /health and API endpoints" (T008, T009)
Task: "Delete backend/requirements.txt" (T010)

# Engineer B — User Story 2 (classifier), in parallel with Engineer A:
Task: "Update classifier/Dockerfile to use uv binary copy pattern" (T011)
Task: "Build classifier container: podman-compose build classifier" (T012)
Task: "Validate classifier /health" (T013)
Task: "Delete classifier/requirements.txt" (T014)
```

---

## Implementation Strategy

### MVP First (User Story 1 Only)

1. Complete Phase 1 (Setup) — generate pyproject.toml + lock for both
2. Complete Phase 3 (US1) — backend migrated and validated
3. **STOP and VALIDATE**: backend container builds, /health passes, endpoints work
4. Proceed to US2 and US3

### Incremental Delivery

1. Setup → Foundation artifacts ready for both services
2. US1 → Backend migrated → Validate independently → ✅
3. US2 → Classifier migrated → Validate independently → ✅
4. US3 → Both AGENTS.md updated → ✅
5. Polish → Full-stack validation → Migration closed

---

## Notes

- [P] tasks = different files, no cross-task dependencies
- US1 and US2 are fully independent — parallel execution by two engineers is safe
- Always validate (health check + smoke test) BEFORE deleting `requirements.txt`
- Commit `uv.lock` alongside every `pyproject.toml` change — never commit one
  without the other
- The CMD lines in both Dockerfiles are unchanged — only the dependency
  installation mechanism changes
- `UV_PROJECT_ENVIRONMENT=/venv` is required because the dev compose volume mount
  (`./backend:/app`, `./classifier:/app`) would hide a `.venv` inside `/app`;
  placing the venv at `/venv` keeps it intact across mounts
