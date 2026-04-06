# Feature Specification: Fix Radix UI Select Import Error in OCI Container

**Feature Branch**: `005-fix-radix-select-import`  
**Created**: 2026-04-06  
**Status**: Draft  
**Input**: User description: "When I am building the docker image for the frontend I am receiving the error: [plugin:vite:import-analysis] Failed to resolve import "@radix-ui/react-select" from "src/components/ui/select.tsx". Does the file exist?. Lets fix this error"

## Clarifications

### Session 2026-04-06

- Q: When exactly does the error occur — during the image build or when loading the page from the running container? → A: The error occurs at runtime when loading the page from a running container; the image build step itself succeeds. Local development works correctly.
- Q: What container toolchain is being used? → A: Podman is used as the container builder; the fix must be treated as OCI-agnostic and apply to any OCI-compatible container runtime, not just Docker.
- Q: Which file is the canonical agent/LLM context file for this project? → A: AGENTS.md files (root-level and per-service) are the only LLM context files used in this project. CLAUDE.md MUST NOT be created or modified. The speckit `update-agent-context.sh` step MUST use the `opencode` agent type (which writes to AGENTS.md) not the `claude` type.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Page Loads Without Errors From Container (Priority: P1)

A developer runs the frontend container image (built with any OCI-compatible builder such as Podman) and opens the application in a browser. All pages load correctly, including those using the Select component, without any import resolution errors.

**Why this priority**: The core issue is that the containerized application fails at runtime when serving pages that use the Select component. This is the primary blocker and must be resolved first.

**Independent Test**: Can be fully tested by building the container image with an OCI-compatible builder (e.g., Podman), starting the container, and navigating to a page that uses the Select component — confirming the page loads with no console errors.

**Acceptance Scenarios**:

1. **Given** the frontend container is running, **When** a developer navigates to a page containing the Select component, **Then** the page loads without a `Failed to resolve import "@radix-ui/react-select"` error
2. **Given** the frontend container is running, **When** the Select component is rendered, **Then** it opens, displays options, and allows selection without runtime errors
3. **Given** the frontend container is running, **When** a developer opens the browser console, **Then** no import resolution errors are visible

---

### User Story 2 - Local Development Remains Unaffected (Priority: P2)

A developer running the application locally (outside a container) continues to have the Select component working correctly after the fix is applied.

**Why this priority**: The fix must not introduce regressions to the local development workflow, which is currently working correctly.

**Independent Test**: Can be tested by starting the local dev server, navigating to any view that uses the Select component, and confirming it renders and operates correctly without console errors.

**Acceptance Scenarios**:

1. **Given** the local development server is running, **When** a user navigates to a page using the Select component, **Then** the component loads without console errors
2. **Given** the local dev server has started, **When** Vite processes its dependency pre-bundling step, **Then** `@radix-ui/react-select` and its sub-packages are resolved without warnings or errors

---

### Edge Cases

- What happens when other Radix UI packages have the same import resolution issue in the container environment? — The fix should address all currently used Radix UI packages, not just `@radix-ui/react-select`
- A stale container image layer cache after the fix is applied may mask the fix — developers should rebuild the image without cache

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The frontend container MUST serve pages containing the Select component without `Failed to resolve import "@radix-ui/react-select"` errors at runtime
- **FR-002**: The container image build step MUST continue to succeed (it currently does; the fix must not break it)
- **FR-003**: The Select UI component MUST render and function correctly when accessed from the running container
- **FR-004**: The fix MUST NOT break the existing local development workflow, which is currently working
- **FR-005**: All Radix UI packages currently used in the project MUST resolve correctly inside the container to prevent similar runtime failures
- **FR-006**: The fix MUST be OCI-agnostic — it must work regardless of the container builder used (Podman, Docker, Buildah, or any OCI-compatible tool)
- **FR-007**: Any speckit agent context update step MUST target AGENTS.md (via `update-agent-context.sh opencode`); CLAUDE.md MUST NOT be created or modified in this project

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Every page in the containerized frontend application loads without import resolution errors in the browser console, regardless of which OCI-compatible builder was used to build the image
- **SC-002**: The Select component in the running container opens, renders options, and accepts selections correctly
- **SC-003**: All existing Select component functionality (open/close, option selection, form integration) works identically in the container as in the local development environment
- **SC-004**: No new import resolution errors are introduced for any other Radix UI packages after the fix is applied
- **SC-005**: No `CLAUDE.md` file exists in the repository after the fix is applied

## Assumptions

- The `@radix-ui/react-select` package is correctly declared as a dependency in `package.json`; the issue is specific to how the module is resolved at runtime inside the OCI container
- Local development works correctly; the fix targets the containerized runtime environment
- The container image build uses `pnpm install --frozen-lockfile`; the `pnpm-lock.yaml` must remain consistent with any dependency changes
- No changes to the Select component's API or behavior are expected as part of this fix
- The current container setup runs the Vite dev server at startup
- The canonical LLM context files for this project are AGENTS.md (root-level and per-service); CLAUDE.md is not used
