# Feature Specification: Migrate Python Services to uv Package Manager

**Feature Branch**: `001-migrate-python-uv`
**Created**: 2026-04-06
**Status**: Draft
**Input**: User description: "As an engineer I want to use technologies that are on the
vanguard of development. Because of that I want to use uv as my package manager for my
python based projects. I want to add the specifications of the project, so we must
update the AGENTS.md for future agentic development context. Both projects backend and
classifier should be migrated to use uv. We must update the Docker images generation
and make sure that everything is working before we close the migration."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Backend Service Runs with uv-Managed Dependencies (Priority: P1)

An engineer building or running the backend service installs and manages all Python
dependencies exclusively through uv. Dependency installation is faster than the
previous workflow, lock files are generated and committed, and the service starts and
passes its health check identically to before the migration.

**Why this priority**: The backend is the most critical runtime service; if its
container fails to build or start, the entire application is broken. Validating it
first reduces risk.

**Independent Test**: Run `podman-compose build backend && podman-compose up backend`
and confirm the container starts successfully, `/health` responds with HTTP 200, and
all existing API endpoints remain functional.

**Acceptance Scenarios**:

1. **Given** the backend source and its container definition, **When** a developer
   builds the container image, **Then** the build completes without errors and all
   Python dependencies are resolved by uv.
2. **Given** a freshly built backend container, **When** the service starts,
   **Then** `/health` returns HTTP 200 and all previously working API endpoints
   continue to work correctly.
3. **Given** a new dependency needs to be added to the backend, **When** the engineer
   uses uv to add it, **Then** the lock file is updated and the change is immediately
   reproducible in the container build.
4. **Given** the uv-based backend is confirmed working, **When** the migration is
   closed, **Then** no legacy dependency files from the previous workflow exist in the
   backend directory.

---

### User Story 2 - Classifier Service Runs with uv-Managed Dependencies (Priority: P2)

An engineer building or running the classifier service installs and manages all Python
dependencies exclusively through uv. The classifier container builds correctly, and
the service starts and responds to health checks as expected.

**Why this priority**: The classifier is a secondary service; it depends on the
foundational uv migration patterns validated in US1 and can be migrated independently
without blocking the backend.

**Independent Test**: Run `podman-compose build classifier && podman-compose up
classifier` and confirm `/health` responds with HTTP 200 and prediction endpoints
function correctly.

**Acceptance Scenarios**:

1. **Given** the classifier source and its container definition, **When** a developer
   builds the container image, **Then** the build completes without errors and all
   Python dependencies (including scikit-learn) are resolved by uv.
2. **Given** a freshly built classifier container, **When** the service starts,
   **Then** `/health` returns HTTP 200 and the service is ready to accept requests.
3. **Given** the uv-based classifier is confirmed working, **When** the migration is
   closed, **Then** no legacy dependency files from the previous workflow exist in the
   classifier directory.

---

### User Story 3 - Developer Documentation Reflects uv Workflow (Priority: P3)

An engineer (or an AI agent) reading the AGENTS.md files for the backend or classifier
finds accurate, up-to-date instructions describing how to install dependencies, add new
packages, and run the services using uv. There are no references to the old package
management workflow that would cause confusion or errors.

**Why this priority**: Documentation is only valuable after the working migration is
confirmed. It unlocks correct agentic development and onboarding from this point
forward.

**Independent Test**: A developer who has never worked on the project can follow the
AGENTS.md instructions exclusively and successfully install dependencies, run tests,
and start each service.

**Acceptance Scenarios**:

1. **Given** a developer reads `backend/AGENTS.md`, **When** they follow the
   dependency installation instructions, **Then** they can install all dependencies
   and start the backend service without additional guidance.
2. **Given** a developer reads `classifier/AGENTS.md`, **When** they follow the
   dependency installation instructions, **Then** they can install all dependencies
   and start the classifier service without additional guidance.
3. **Given** an AI agent uses AGENTS.md for context, **When** it generates commands
   related to package management, **Then** those commands use uv syntax and produce
   correct results.

---

### Edge Cases

- What happens when the container build environment has no internet access (air-gapped
  build)? The lock file MUST capture all resolved packages so that the build can
  install from cache or an internal mirror.
- What happens if a dependency is only available on PyPI and not yet indexed by the
  resolver? The migration process MUST verify all current dependencies resolve before
  the old tooling is removed.
- What happens when both services are rebuilt simultaneously via `podman-compose up
  --build`? Each service MUST build independently without shared-state conflicts.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The backend service MUST declare all Python dependencies managed by uv,
  with a committed lock file ensuring reproducible installations.
- **FR-002**: The classifier service MUST declare all Python dependencies managed by
  uv, with a committed lock file ensuring reproducible installations.
- **FR-003**: Container image definitions for both services MUST install dependencies
  using uv so that development and production environments are consistent.
- **FR-004**: The full application stack MUST start successfully via
  `podman-compose up --build`, with all services passing their health checks after
  migration.
- **FR-005**: `backend/AGENTS.md` MUST be updated to document the uv-based workflow
  for dependency installation, adding packages, and running the service.
- **FR-006**: `classifier/AGENTS.md` MUST be updated to document the uv-based workflow
  for dependency installation, adding packages, and running the service.
- **FR-007**: All dependency files and lock files generated by uv MUST be committed to
  version control so the build is fully reproducible.
- **FR-008**: The migration MUST NOT change any application behavior; all existing
  functionality MUST work identically after migration.
- **FR-009**: All legacy dependency declaration files used by the previous package
  management workflow MUST be removed from both services once the uv-based setup is
  confirmed working. No legacy files that could cause confusion or accidental use of
  the old tooling MUST remain in the repository.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Both backend and classifier container images build without errors after
  migration, verified by a successful `podman-compose up --build` run.
- **SC-002**: All previously passing health checks (`/health` for backend and
  classifier) continue to pass after migration.
- **SC-003**: A developer unfamiliar with the project can follow updated AGENTS.md
  instructions and have a working local environment for both services without
  consulting any external documentation.
- **SC-004**: Dependency installation for both services completes faster than the
  previous workflow (measured by container image build time for the dependency
  installation step).
- **SC-005**: Zero application-level regressions: all API endpoints and classification
  features confirmed functional after migration via manual smoke test of the full stack.
- **SC-006**: Zero legacy dependency files remain in the repository for either service
  at migration close — the repository contains only the uv-based dependency declarations
  and lock files.

## Assumptions

- The current dependencies for both services are fully resolvable by uv with no
  incompatible packages; a pre-migration compatibility check will be performed as part
  of the work.
- The container build environment has internet access to PyPI during the migration
  (air-gapped deployment hardening is out of scope for this migration).
- The frontend service (React/TypeScript) is out of scope; only `backend` and
  `classifier` Python services are being migrated.
- uv supports all Python versions used by both services; no Python version changes are
  required as part of this migration.
- Existing Alembic migration scripts and seed scripts are not affected by the package
  manager change and will continue to work after migration.
